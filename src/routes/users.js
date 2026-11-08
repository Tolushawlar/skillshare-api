import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound } from '../utils/errors.js';

export const usersRouter = Router();

const updateMeSchema = z.object({
  full_name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(7).max(20).nullable().optional(),
  avatar_url: z.string().url().max(2048).nullable().optional(),
  location_label: z.string().trim().max(160).nullable().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
}).refine(
  (data) => (data.lat === undefined) === (data.lng === undefined),
  { message: 'Provide both lat and lng, or neither.', path: ['lat'] },
);

async function loadProfile(userId) {
  const result = await query(
    `select u.id, u.role, u.full_name, u.email, u.phone, u.avatar_url, u.location_label,
            st_y(u.base_location::geometry) as lat, st_x(u.base_location::geometry) as lng,
            u.status, u.created_at, u.updated_at,
            wp.trade, wp.bio, wp.years_experience, wp.hourly_rate_kobo, wp.service_radius_m,
            wp.is_online, wp.availability_status, wp.verification_status, wp.rating_avg,
            wp.rating_count, wp.jobs_completed, wp.verified_at
     from public.users u
     left join public.worker_profiles wp on wp.user_id = u.id
     where u.id = $1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

usersRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const profile = await loadProfile(req.user.id);
  if (!profile) {
    throw notFound('Profile not found.');
  }
  res.json({ data: profile });
}));

usersRouter.patch('/me', requireAuth, validate(updateMeSchema), asyncHandler(async (req, res) => {
  const input = req.body;
  const fields = [];
  const params = [];

  if (input.full_name !== undefined) {
    params.push(input.full_name);
    fields.push(`full_name = $${params.length}`);
  }
  if (input.phone !== undefined) {
    params.push(input.phone);
    fields.push(`phone = $${params.length}`);
  }
  if (input.avatar_url !== undefined) {
    params.push(input.avatar_url);
    fields.push(`avatar_url = $${params.length}`);
  }
  if (input.location_label !== undefined) {
    params.push(input.location_label);
    fields.push(`location_label = $${params.length}`);
  }
  if (input.lat !== undefined && input.lng !== undefined) {
    params.push(input.lat, input.lng);
    fields.push(`base_location = st_setsrid(st_makepoint($${params.length}, $${params.length - 1}), 4326)::geography`);
  }

  if (fields.length === 0) {
    throw badRequest('NOTHING_TO_UPDATE', 'Provide at least one field to update.');
  }

  params.push(req.user.id);
  await query(
    `update public.users set ${fields.join(', ')} where id = $${params.length}`,
    params,
  );

  const profile = await loadProfile(req.user.id);
  res.json({ data: profile });
}));
