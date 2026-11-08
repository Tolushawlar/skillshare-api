import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { supabaseAdmin, supabaseAnon } from '../lib/supabase.js';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError, conflict, unauthorized } from '../utils/errors.js';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts. Try again later.' } },
});

const latLngPair = (data) => {
  const hasLat = data.lat !== undefined;
  const hasLng = data.lng !== undefined;
  return hasLat === hasLng;
};

const signupSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  phone: z.string().trim().min(7).max(20).optional(),
  role: z.enum(['client', 'worker']).default('client'),
  location_label: z.string().trim().max(160).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  trade: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(1500).optional(),
  years_experience: z.number().int().min(0).max(60).optional(),
  hourly_rate_kobo: z.number().int().min(0).max(100_000_000).optional(),
  service_radius_m: z.number().int().min(1000).max(50_000).optional(),
}).refine(latLngPair, {
  message: 'Provide both lat and lng, or neither.',
  path: ['lat'],
}).refine((data) => data.role !== 'worker' || Boolean(data.trade), {
  message: 'trade is required for worker accounts.',
  path: ['trade'],
});

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

async function ensureProfile(userId, input) {
  const existing = await query('select id from public.users where id = $1', [userId]);
  if (existing.rows[0]) {
    return;
  }

  await query(
    `insert into public.users (id, role, full_name, email, phone, location_label, base_location)
     values ($1, $2, $3, $4, $5, $6,
       case when $7::double precision is not null and $8::double precision is not null
         then st_setsrid(st_makepoint($8, $7), 4326)::geography else null end)
     on conflict (id) do nothing`,
    [
      userId,
      input.role,
      input.full_name,
      input.email,
      input.phone ?? null,
      input.location_label ?? null,
      input.lat ?? null,
      input.lng ?? null,
    ],
  );

  if (input.role === 'worker') {
    await query(
      `insert into public.worker_profiles
         (user_id, trade, bio, years_experience, hourly_rate_kobo, service_radius_m, is_online, verification_status)
       values ($1, $2, $3, $4, $5, $6, true, 'pending')
       on conflict (user_id) do nothing`,
      [
        userId,
        input.trade,
        input.bio ?? null,
        input.years_experience ?? 0,
        input.hourly_rate_kobo ?? 0,
        input.service_radius_m ?? 10_000,
      ],
    );
  }
}

async function getProfile(userId) {
  const result = await query(
    `select u.id, u.role, u.full_name, u.email, u.phone, u.avatar_url, u.location_label,
            st_y(u.base_location::geometry) as lat, st_x(u.base_location::geometry) as lng,
            u.status, u.created_at,
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

authRouter.post('/signup', authLimiter, validate(signupSchema), asyncHandler(async (req, res) => {
  const input = req.body;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.full_name,
      role: input.role,
      phone: input.phone,
      location_label: input.location_label,
      lat: input.lat,
      lng: input.lng,
      trade: input.trade,
      bio: input.bio,
      years_experience: input.years_experience,
      hourly_rate_kobo: input.hourly_rate_kobo,
      service_radius_m: input.service_radius_m,
    },
  });

  if (error) {
    if (error.status === 422 || /already|exists|registered|duplicate/i.test(error.message)) {
      throw conflict('EMAIL_IN_USE', 'An account with that email already exists.');
    }
    throw new ApiError(502, 'AUTH_PROVIDER_ERROR', error.message);
  }

  await ensureProfile(data.user.id, input);
  const profile = await getProfile(data.user.id);

  let session = null;
  if (supabaseAnon) {
    const signIn = await supabaseAnon.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (!signIn.error) {
      session = signIn.data.session;
    }
  }

  res.status(201).json({ data: { user: data.user, profile, session } });
}));

authRouter.post('/login', authLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
  if (!supabaseAnon) {
    throw new ApiError(501, 'AUTH_NOT_CONFIGURED', 'SUPABASE_ANON_KEY is not configured.');
  }

  const { data, error } = await supabaseAnon.auth.signInWithPassword({
    email: req.body.email,
    password: req.body.password,
  });

  if (error || !data.session) {
    throw unauthorized('Email or password is incorrect.');
  }

  const profile = await getProfile(data.user.id);
  if (!profile || profile.status !== 'active') {
    throw unauthorized('This account is not active.');
  }

  res.json({ data: { user: data.user, profile, session: data.session } });
}));

authRouter.post('/refresh', authLimiter, validate(refreshSchema), asyncHandler(async (req, res) => {
  if (!supabaseAnon) {
    throw new ApiError(501, 'AUTH_NOT_CONFIGURED', 'SUPABASE_ANON_KEY is not configured.');
  }

  const { data, error } = await supabaseAnon.auth.refreshSession({
    refresh_token: req.body.refresh_token,
  });

  if (error || !data.session) {
    throw unauthorized('Could not refresh the session. Log in again.');
  }

  res.json({ data: { session: data.session, user: data.user } });
}));

authRouter.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  try {
    await supabaseAdmin.auth.admin.signOut(req.accessToken);
  } catch {
    // The token may already be expired; the client should discard it regardless.
  }
  res.status(204).send();
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const profile = await getProfile(req.user.id);
  res.json({ data: profile });
}));
