import { query, withTransaction } from '../lib/db.js';
import {
  ACTIVE_BOOKING_STATUSES,
  canTransition,
  estimatePriceKobo,
  generatePublicRef,
  requestExpirySeconds,
  transitionNote,
} from '../domain/booking.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';

const ACTOR_ACTIONS = {
  worker: {
    accept: 'accepted',
    decline: 'declined',
    en_route: 'en_route',
    arrived: 'arrived',
    start: 'in_progress',
    complete: 'completed',
  },
  client: {
    cancel: 'cancelled',
  },
};

const TIMESTAMP_COLUMNS = {
  accepted: 'accepted_at',
  en_route: 'en_route_at',
  arrived: 'arrived_at',
  in_progress: 'started_at',
  completed: 'completed_at',
  cancelled: 'cancelled_at',
};

function parseScheduledWindow(payload) {
  if (payload.urgency !== 'scheduled') {
    return { start: null, end: null };
  }
  if (!payload.scheduled_start) {
    throw badRequest('SCHEDULED_TIME_REQUIRED', 'scheduled_start is required for a scheduled booking.');
  }

  const start = new Date(payload.scheduled_start);
  if (Number.isNaN(start.getTime())) {
    throw badRequest('INVALID_SCHEDULE', 'scheduled_start must be a valid ISO date-time.');
  }
  if (start.getTime() < Date.now() - 60_000) {
    throw badRequest('INVALID_SCHEDULE', 'scheduled_start must be in the future.');
  }

  const end = payload.scheduled_end ? new Date(payload.scheduled_end) : new Date(start.getTime() + 2 * 3_600_000);
  if (Number.isNaN(end.getTime()) || end <= start) {
    throw badRequest('INVALID_SCHEDULE', 'scheduled_end must be after scheduled_start.');
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

export async function createBooking(clientUser, payload) {
  const { start, end } = parseScheduledWindow(payload);

  const workerResult = await query(
    `select u.id, u.full_name, u.status, u.base_location, wp.*
     from public.users u
     join public.worker_profiles wp on wp.user_id = u.id
     where u.id = $1 and u.role = 'worker'`,
    [payload.worker_id],
  );
  const worker = workerResult.rows[0];

  if (!worker) {
    throw notFound('Worker not found.');
  }
  if (worker.status !== 'active') {
    throw conflict('WORKER_UNAVAILABLE', 'This worker is not accepting jobs right now.');
  }
  if (worker.verification_status !== 'verified') {
    throw conflict('WORKER_NOT_VERIFIED', 'This worker has not completed verification yet.');
  }
  if (['asap', 'emergency'].includes(payload.urgency) && !worker.is_online) {
    throw conflict('WORKER_OFFLINE', 'This worker is currently offline. Try scheduling or another worker.');
  }

  if (payload.service_id) {
    const service = await query(
      'select id from public.services where id = $1 and worker_id = $2 and is_active = true',
      [payload.service_id, worker.id],
    );
    if (!service.rows[0]) {
      throw badRequest('INVALID_SERVICE', 'That service does not belong to this worker.');
    }
  }

  const distanceResult = await query(
    `select st_distance(base_location, st_setsrid(st_makepoint($2, $1), 4326)::geography) as distance_m
     from public.users where id = $3`,
    [payload.lat, payload.lng, worker.id],
  );
  const distanceM = distanceResult.rows[0]?.distance_m;
  if (distanceM !== null && distanceM !== undefined && Number(distanceM) > worker.service_radius_m) {
    throw badRequest(
      'OUTSIDE_SERVICE_AREA',
      `This worker only serves a ${Math.round(worker.service_radius_m / 1000)} km radius. Choose a closer worker or a scheduled arrangement.`,
    );
  }

  const estimatedPrice = estimatePriceKobo(worker.hourly_rate_kobo, payload.urgency);
  const expiresAt = new Date(Date.now() + requestExpirySeconds(payload.urgency) * 1000).toISOString();

  return withTransaction(async (client) => {
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [worker.id]);

    if (start && end) {
      const overlap = await client.query(
        `select 1 from public.bookings
         where worker_id = $1
           and status in ('accepted', 'en_route', 'arrived', 'in_progress')
           and scheduled_start < $3
           and scheduled_end > $2
         limit 1`,
        [worker.id, start, end],
      );
      if (overlap.rows[0]) {
        throw conflict('BOOKING_SLOT_UNAVAILABLE', 'This worker already has a job at the selected time.');
      }
    } else {
      const active = await client.query(
        `select 1 from public.bookings
         where worker_id = $1 and status = any($2::public.booking_status[])
         limit 1`,
        [worker.id, ACTIVE_BOOKING_STATUSES],
      );
      if (active.rows[0]) {
        throw conflict('WORKER_BUSY', 'This worker is currently on another job.');
      }
    }

    const inserted = await client.query(
      `insert into public.bookings
        (public_ref, client_id, worker_id, trade, description, address, location, urgency,
         scheduled_start, scheduled_end, status, estimated_price_kobo, payment_method, expires_at)
       values ($1, $2, $3, $4, $5, $6, st_setsrid(st_makepoint($7, $8), 4326)::geography,
               $9, $10, $11, 'requested', $12, $13, $14)
       returning *`,
      [
        generatePublicRef(),
        clientUser.id,
        worker.id,
        worker.trade,
        payload.description,
        payload.address,
        payload.lng,
        payload.lat,
        payload.urgency,
        start,
        end,
        estimatedPrice,
        payload.payment_method,
        expiresAt,
      ],
    );

    const booking = inserted.rows[0];

    await client.query(
      `insert into public.booking_events (booking_id, from_status, to_status, actor_id, note)
       values ($1, null, 'requested', $2, 'Booking created by client.')`,
      [booking.id, clientUser.id],
    );

    return booking;
  });
}

export async function getBookingDetail(bookingId, user) {
  const result = await query(
    `select b.*,
            st_y(b.location::geometry) as lat, st_x(b.location::geometry) as lng,
            c.full_name as client_name, c.phone as client_phone, c.location_label as client_area,
            w.full_name as worker_name, w.phone as worker_phone, w.location_label as worker_area,
            wp.trade as worker_trade, wp.rating_avg as worker_rating,
            wp.rating_count as worker_rating_count, wp.verification_status,
            wp.is_online as worker_online
     from public.bookings b
     join public.users c on c.id = b.client_id
     join public.users w on w.id = b.worker_id
     left join public.worker_profiles wp on wp.user_id = b.worker_id
     where b.id = $1`,
    [bookingId],
  );

  const booking = result.rows[0];
  if (!booking) {
    throw notFound('Booking not found.');
  }

  const isParticipant = booking.client_id === user.id || booking.worker_id === user.id;
  if (!isParticipant && user.role !== 'admin') {
    throw forbidden();
  }

  const [events, review] = await Promise.all([
    query(
      'select * from public.booking_events where booking_id = $1 order by created_at asc, id asc',
      [bookingId],
    ),
    query('select * from public.reviews where booking_id = $1', [bookingId]),
  ]);

  const { location: _location, ...safeBooking } = booking;

  return {
    ...safeBooking,
    events: events.rows,
    review: review.rows[0] ?? null,
  };
}

export async function listBookings(user, filters) {
  const { status, limit, offset } = filters;
  const params = [];
  const conditions = [];

  if (user.role === 'client') {
    params.push(user.id);
    conditions.push(`b.client_id = $${params.length}`);
  } else if (user.role === 'worker') {
    params.push(user.id);
    conditions.push(`b.worker_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`b.status = $${params.length}::public.booking_status`);
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  params.push(limit, offset);

  const result = await query(
    `select b.*, st_y(b.location::geometry) as lat, st_x(b.location::geometry) as lng,
            c.full_name as client_name, w.full_name as worker_name,
            wp.trade as worker_trade, wp.rating_avg as worker_rating
     from public.bookings b
     join public.users c on c.id = b.client_id
     join public.users w on w.id = b.worker_id
     left join public.worker_profiles wp on wp.user_id = b.worker_id
     ${where}
     order by b.created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
  );

  return result.rows.map(({ location: _location, ...booking }) => booking);
}

export async function transitionBooking(bookingId, user, action, reason) {
  const mapped = ACTOR_ACTIONS[user.role]?.[action];

  return withTransaction(async (client) => {
    const result = await client.query('select * from public.bookings where id = $1 for update', [bookingId]);
    const booking = result.rows[0];

    if (!booking) {
      throw notFound('Booking not found.');
    }

    const isClient = booking.client_id === user.id;
    const isWorker = booking.worker_id === user.id;

    if (!isClient && !isWorker) {
      throw forbidden();
    }

    let targetStatus;

    if (action === 'cancel') {
      if (!['requested', 'accepted', 'en_route', 'arrived'].includes(booking.status)) {
        throw conflict('INVALID_TRANSITION', 'This booking can no longer be cancelled.');
      }
      targetStatus = 'cancelled';
    } else {
      if (!mapped || user.role !== 'worker' || !isWorker) {
        throw forbidden('Only the assigned worker can perform that action.');
      }
      targetStatus = mapped;
    }

    if (!canTransition(booking.status, targetStatus)) {
      throw conflict(
        'INVALID_TRANSITION',
        `Cannot move a booking from ${booking.status} to ${targetStatus}.`,
      );
    }

    const timestampColumn = TIMESTAMP_COLUMNS[targetStatus];
    const fields = ['status = $1', 'version = version + 1'];
    const params = [targetStatus];

    if (timestampColumn) {
      params.push(new Date().toISOString());
      fields.push(`${timestampColumn} = $${params.length}`);
    }

    if (targetStatus === 'completed') {
      fields.push('final_price_kobo = estimated_price_kobo');
      fields.push("payment_status = 'paid'");
    }

    if (targetStatus === 'cancelled') {
      params.push(reason ?? null);
      fields.push(`cancellation_reason = $${params.length}`);
      params.push(user.id);
      fields.push(`cancelled_by = $${params.length}`);
      fields.push("payment_status = case when payment_status = 'paid' then 'refunded' else payment_status end");
    }

    params.push(booking.id);
    const updated = await client.query(
      `update public.bookings set ${fields.join(', ')} where id = $${params.length} returning *`,
      params,
    );

    await client.query(
      `insert into public.booking_events (booking_id, from_status, to_status, actor_id, note)
       values ($1, $2, $3, $4, $5)`,
      [
        booking.id,
        booking.status,
        targetStatus,
        user.id,
        targetStatus === 'cancelled' && reason ? `${transitionNote(targetStatus, user.role)} Reason: ${reason}` : transitionNote(targetStatus, user.role),
      ],
    );

    if (targetStatus === 'completed') {
      await client.query(
        'update public.worker_profiles set jobs_completed = jobs_completed + 1 where user_id = $1',
        [booking.worker_id],
      );
    }

    return updated.rows[0];
  });
}

export async function addReview(bookingId, clientUser, payload) {
  return withTransaction(async (client) => {
    const result = await client.query('select * from public.bookings where id = $1 for update', [bookingId]);
    const booking = result.rows[0];

    if (!booking) {
      throw notFound('Booking not found.');
    }
    if (booking.client_id !== clientUser.id) {
      throw forbidden('Only the client who made the booking can review it.');
    }
    if (booking.status !== 'completed') {
      throw conflict('BOOKING_NOT_COMPLETED', 'You can only review a completed booking.');
    }

    const existing = await client.query('select id from public.reviews where booking_id = $1', [bookingId]);
    if (existing.rows[0]) {
      throw conflict('REVIEW_EXISTS', 'You have already reviewed this booking.');
    }

    const inserted = await client.query(
      `insert into public.reviews (booking_id, client_id, worker_id, rating, comment, tags)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [bookingId, clientUser.id, booking.worker_id, payload.rating, payload.comment ?? null, payload.tags ?? []],
    );

    await client.query(
      `update public.worker_profiles wp set
         rating_avg = coalesce((select round(avg(r.rating), 2) from public.reviews r where r.worker_id = wp.user_id), 0),
         rating_count = (select count(*) from public.reviews r where r.worker_id = wp.user_id)
       where wp.user_id = $1`,
      [booking.worker_id],
    );

    return inserted.rows[0];
  });
}
