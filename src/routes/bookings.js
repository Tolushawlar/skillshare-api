import { createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { BOOKING_STATUSES } from '../domain/booking.js';
import { query } from '../lib/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { conflict } from '../utils/errors.js';
import {
  addReview,
  createBooking,
  getBookingDetail,
  listBookings,
  transitionBooking,
} from '../services/bookingService.js';

export const bookingsRouter = Router();

const createBookingSchema = z.object({
  worker_id: z.string().uuid(),
  description: z.string().trim().min(10).max(2000),
  address: z.string().trim().min(5).max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  urgency: z.enum(['asap', 'scheduled', 'emergency']).default('asap'),
  scheduled_start: z.string().max(40).optional(),
  scheduled_end: z.string().max(40).optional(),
  payment_method: z.enum(['cash', 'card', 'transfer']).default('cash'),
  service_id: z.string().uuid().optional(),
});

const listQuerySchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const cancelSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

const statusSchema = z.object({
  status: z.enum(['en_route', 'arrived', 'in_progress', 'completed']),
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
  tags: z.array(z.string().trim().max(40)).max(10).optional(),
});

const idParamSchema = z.object({ id: z.string().uuid() });

const STATUS_ACTIONS = {
  en_route: 'en_route',
  arrived: 'arrived',
  in_progress: 'start',
  completed: 'complete',
};

function requestHash(body) {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

bookingsRouter.post('/', requireAuth, requireRole('client'), validate(createBookingSchema), asyncHandler(async (req, res) => {
  const idempotencyKey = req.get('Idempotency-Key');
  const hash = requestHash(req.body);

  if (idempotencyKey) {
    const existing = await query(
      'select * from public.idempotency_keys where user_id = $1 and key = $2',
      [req.user.id, idempotencyKey],
    );
    const record = existing.rows[0];
    if (record) {
      if (record.request_hash !== hash) {
        throw conflict('IDEMPOTENCY_CONFLICT', 'This idempotency key was already used with a different request.');
      }
      return res.status(record.response_status).json(record.response_body);
    }
  }

  const booking = await createBooking(req.user, req.body);
  const response = { data: await getBookingDetail(booking.id, req.user) };

  if (idempotencyKey) {
    await query(
      `insert into public.idempotency_keys (user_id, key, endpoint, request_hash, response_status, response_body)
       values ($1, $2, 'POST /bookings', $3, 201, $4::jsonb)
       on conflict (user_id, key) do nothing`,
      [req.user.id, idempotencyKey, hash, JSON.stringify(response)],
    );
  }

  return res.status(201).json(response);
}));

bookingsRouter.get('/', requireAuth, validate(listQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const bookings = await listBookings(req.user, req.query);
  res.json({ data: bookings, meta: { count: bookings.length, ...req.query } });
}));

bookingsRouter.get('/:id', requireAuth, validate(idParamSchema, 'params'), asyncHandler(async (req, res) => {
  const booking = await getBookingDetail(req.params.id, req.user);
  res.json({ data: booking });
}));

bookingsRouter.post('/:id/accept', requireAuth, requireRole('worker'), validate(idParamSchema, 'params'), asyncHandler(async (req, res) => {
  await transitionBooking(req.params.id, req.user, 'accept');
  const booking = await getBookingDetail(req.params.id, req.user);
  res.json({ data: booking });
}));

bookingsRouter.post('/:id/decline', requireAuth, requireRole('worker'), validate(idParamSchema, 'params'), asyncHandler(async (req, res) => {
  await transitionBooking(req.params.id, req.user, 'decline');
  const booking = await getBookingDetail(req.params.id, req.user);
  res.json({ data: booking });
}));

bookingsRouter.post('/:id/cancel', requireAuth, validate(idParamSchema, 'params'), validate(cancelSchema), asyncHandler(async (req, res) => {
  await transitionBooking(req.params.id, req.user, 'cancel', req.body.reason);
  const booking = await getBookingDetail(req.params.id, req.user);
  res.json({ data: booking });
}));

bookingsRouter.post('/:id/status', requireAuth, requireRole('worker'), validate(idParamSchema, 'params'), validate(statusSchema), asyncHandler(async (req, res) => {
  const action = STATUS_ACTIONS[req.body.status];
  await transitionBooking(req.params.id, req.user, action);
  const booking = await getBookingDetail(req.params.id, req.user);
  res.json({ data: booking });
}));

bookingsRouter.post('/:id/review', requireAuth, requireRole('client'), validate(idParamSchema, 'params'), validate(reviewSchema), asyncHandler(async (req, res) => {
  const review = await addReview(req.params.id, req.user, req.body);
  res.status(201).json({ data: review });
}));
