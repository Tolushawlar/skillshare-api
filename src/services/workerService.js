import { query, withTransaction } from '../lib/db.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';

export async function nearbyWorkers(filters) {
  const result = await query(
    `select * from public.nearby_workers($1, $2, $3, $4, $5, $6, $7)`,
    [
      filters.lat,
      filters.lng,
      filters.radius_m,
      filters.trade ?? null,
      filters.min_rating ?? null,
      filters.sort,
      filters.limit,
    ],
  );
  return result.rows;
}

export async function getPublicWorker(workerId, viewer) {
  const result = await query(
    `select u.id, u.full_name, u.avatar_url, u.location_label,
            st_y(u.base_location::geometry) as lat, st_x(u.base_location::geometry) as lng,
            wp.trade, wp.bio, wp.years_experience, wp.hourly_rate_kobo, wp.service_radius_m,
            wp.is_online, wp.availability_status, wp.verification_status, wp.rating_avg,
            wp.rating_count, wp.jobs_completed, wp.verified_at
     from public.users u
     join public.worker_profiles wp on wp.user_id = u.id
     where u.id = $1 and u.role = 'worker'`,
    [workerId],
  );

  const worker = result.rows[0];
  if (!worker) {
    throw notFound('Worker not found.');
  }

  const isOwner = viewer?.id === worker.id;
  const isAdmin = viewer?.role === 'admin';
  if (worker.verification_status !== 'verified' && !isOwner && !isAdmin) {
    throw notFound('Worker not found.');
  }

  const [services, portfolio, reviews] = await Promise.all([
    query(
      `select id, title, description, pricing_type, price_kobo, duration_minutes
       from public.services
       where worker_id = $1 and is_active = true
       order by created_at asc`,
      [workerId],
    ),
    query(
      `select id, media_url, title, sort_order
       from public.portfolio_items
       where worker_id = $1
       order by sort_order asc, created_at asc`,
      [workerId],
    ),
    query(
      `select r.id, r.rating, r.comment, r.tags, r.created_at, c.full_name as client_name
       from public.reviews r
       join public.users c on c.id = r.client_id
       where r.worker_id = $1
       order by r.created_at desc
       limit 30`,
      [workerId],
    ),
  ]);

  return {
    ...worker,
    services: services.rows,
    portfolio: portfolio.rows,
    reviews: reviews.rows,
  };
}

export async function getMyWorkerProfile(userId) {
  const result = await query(
    `select u.id, u.full_name, u.email, u.phone, u.avatar_url, u.location_label,
            st_y(u.base_location::geometry) as lat, st_x(u.base_location::geometry) as lng,
            u.status,
            wp.trade, wp.bio, wp.years_experience, wp.hourly_rate_kobo, wp.service_radius_m,
            wp.is_online, wp.availability_status, wp.verification_status, wp.verification_note,
            wp.rating_avg, wp.rating_count, wp.jobs_completed, wp.verified_at
     from public.users u
     join public.worker_profiles wp on wp.user_id = u.id
     where u.id = $1 and u.role = 'worker'`,
    [userId],
  );

  const profile = result.rows[0];
  if (!profile) {
    throw notFound('Worker profile not found.');
  }

  const [services, portfolio, verification] = await Promise.all([
    query(
      'select * from public.services where worker_id = $1 order by created_at asc',
      [userId],
    ),
    query(
      'select * from public.portfolio_items where worker_id = $1 order by sort_order asc, created_at asc',
      [userId],
    ),
    query(
      'select * from public.verification_submissions where worker_id = $1 order by submitted_at desc limit 1',
      [userId],
    ),
  ]);

  return {
    ...profile,
    services: services.rows,
    portfolio: portfolio.rows,
    verification: verification.rows[0] ?? null,
  };
}

export async function updateMyWorkerProfile(userId, payload) {
  await withTransaction(async (client) => {
    const current = await client.query(
      'select * from public.worker_profiles where user_id = $1',
      [userId],
    );
    if (!current.rows[0]) {
      throw notFound('Worker profile not found.');
    }

    if (payload.location_label !== undefined || payload.lat !== undefined || payload.lng !== undefined) {
      const fields = [];
      const params = [];
      if (payload.location_label !== undefined) {
        params.push(payload.location_label);
        fields.push(`location_label = $${params.length}`);
      }
      if (payload.lat !== undefined && payload.lng !== undefined) {
        params.push(payload.lat, payload.lng);
        fields.push(`base_location = st_setsrid(st_makepoint($${params.length}, $${params.length - 1}), 4326)::geography`);
      }
      params.push(userId);
      await client.query(
        `update public.users set ${fields.join(', ')} where id = $${params.length}`,
        params,
      );
    }

    const fieldMap = {
      trade: 'trade',
      bio: 'bio',
      years_experience: 'years_experience',
      hourly_rate_kobo: 'hourly_rate_kobo',
      service_radius_m: 'service_radius_m',
      availability_status: 'availability_status',
      is_online: 'is_online',
    };

    const fields = [];
    const params = [];
    for (const [key, column] of Object.entries(fieldMap)) {
      if (payload[key] !== undefined) {
        params.push(payload[key]);
        fields.push(`${column} = $${params.length}`);
      }
    }

    if (fields.length > 0) {
      params.push(userId);
      await client.query(
        `update public.worker_profiles set ${fields.join(', ')} where user_id = $${params.length}`,
        params,
      );
    }

  });

  return getMyWorkerProfile(userId);
}

export async function setAvailability(userId, payload) {
  const result = await query(
    `update public.worker_profiles
     set is_online = $1, availability_status = $2
     where user_id = $3
     returning *`,
    [payload.is_online, payload.availability_status, userId],
  );
  if (!result.rows[0]) {
    throw notFound('Worker profile not found.');
  }
  return result.rows[0];
}

export async function createService(userId, payload) {
  const result = await query(
    `insert into public.services (worker_id, title, description, pricing_type, price_kobo, duration_minutes)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      userId,
      payload.title,
      payload.description ?? null,
      payload.pricing_type,
      payload.price_kobo,
      payload.duration_minutes ?? null,
    ],
  );
  return result.rows[0];
}

export async function updateService(userId, serviceId, payload) {
  const current = await query(
    'select * from public.services where id = $1 and worker_id = $2',
    [serviceId, userId],
  );
  if (!current.rows[0]) {
    throw notFound('Service not found.');
  }

  const fieldMap = {
    title: 'title',
    description: 'description',
    pricing_type: 'pricing_type',
    price_kobo: 'price_kobo',
    duration_minutes: 'duration_minutes',
    is_active: 'is_active',
  };

  const fields = [];
  const params = [];
  for (const [key, column] of Object.entries(fieldMap)) {
    if (payload[key] !== undefined) {
      params.push(payload[key]);
      fields.push(`${column} = $${params.length}`);
    }
  }

  if (fields.length === 0) {
    throw badRequest('NOTHING_TO_UPDATE', 'Provide at least one field to update.');
  }

  params.push(serviceId, userId);
  const result = await query(
    `update public.services set ${fields.join(', ')}
     where id = $${params.length - 1} and worker_id = $${params.length}
     returning *`,
    params,
  );
  return result.rows[0];
}

export async function deactivateService(userId, serviceId) {
  const result = await query(
    `update public.services set is_active = false
     where id = $1 and worker_id = $2
     returning id`,
    [serviceId, userId],
  );
  if (!result.rows[0]) {
    throw notFound('Service not found.');
  }
}

export async function addPortfolioItem(userId, payload) {
  const result = await query(
    `insert into public.portfolio_items (worker_id, media_url, title, sort_order)
     values ($1, $2, $3, $4)
     returning *`,
    [userId, payload.media_url, payload.title ?? null, payload.sort_order ?? 0],
  );
  return result.rows[0];
}

export async function removePortfolioItem(userId, itemId) {
  const result = await query(
    'delete from public.portfolio_items where id = $1 and worker_id = $2 returning id',
    [itemId, userId],
  );
  if (!result.rows[0]) {
    throw notFound('Portfolio item not found.');
  }
}

export async function submitVerification(userId, payload) {
  return withTransaction(async (client) => {
    const profile = await client.query(
      'select verification_status from public.worker_profiles where user_id = $1 for update',
      [userId],
    );
    if (!profile.rows[0]) {
      throw notFound('Worker profile not found.');
    }
    if (profile.rows[0].verification_status === 'verified') {
      throw conflict('ALREADY_VERIFIED', 'This profile is already verified.');
    }

    const pending = await client.query(
      `select id from public.verification_submissions
       where worker_id = $1 and status = 'pending'`,
      [userId],
    );
    if (pending.rows[0]) {
      throw conflict('SUBMISSION_PENDING', 'A verification submission is already under review.');
    }

    const inserted = await client.query(
      `insert into public.verification_submissions
         (worker_id, id_type, id_number_last4, selfie_url, certificate_url, "references", notes)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning *`,
      [
        userId,
        payload.id_type,
        payload.id_number_last4 ?? null,
        payload.selfie_url,
        payload.certificate_url ?? null,
        JSON.stringify(payload.references ?? []),
        payload.notes ?? null,
      ],
    );

    await client.query(
      `update public.worker_profiles
       set verification_status = 'pending', verification_note = null
       where user_id = $1`,
      [userId],
    );

    return inserted.rows[0];
  });
}

export async function getMyVerification(userId) {
  const result = await query(
    `select * from public.verification_submissions
     where worker_id = $1 order by submitted_at desc limit 1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function assertWorker(user) {
  if (user.role !== 'worker') {
    throw forbidden('This endpoint is only available to workers.');
  }
}
