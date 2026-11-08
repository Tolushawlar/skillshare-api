import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  addPortfolioItem,
  assertWorker,
  createService,
  deactivateService,
  getMyVerification,
  getMyWorkerProfile,
  getPublicWorker,
  nearbyWorkers,
  removePortfolioItem,
  setAvailability,
  submitVerification,
  updateMyWorkerProfile,
  updateService,
} from '../services/workerService.js';

export const workersRouter = Router();

const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius_m: z.coerce.number().int().min(1000).max(50_000).default(10_000),
  trade: z.string().trim().max(80).optional(),
  min_rating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(['nearest', 'rating', 'price']).default('nearest'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const updateProfileSchema = z.object({
  trade: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(1500).nullable().optional(),
  years_experience: z.number().int().min(0).max(60).optional(),
  hourly_rate_kobo: z.number().int().min(0).max(100_000_000).optional(),
  service_radius_m: z.number().int().min(1000).max(50_000).optional(),
  availability_status: z.enum(['available', 'busy', 'offline']).optional(),
  is_online: z.boolean().optional(),
  location_label: z.string().trim().max(160).nullable().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
}).refine(
  (data) => (data.lat === undefined) === (data.lng === undefined),
  { message: 'Provide both lat and lng, or neither.', path: ['lat'] },
);

const availabilitySchema = z.object({
  is_online: z.boolean(),
  availability_status: z.enum(['available', 'busy', 'offline']),
});

const serviceSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  pricing_type: z.enum(['fixed', 'hourly', 'quote']),
  price_kobo: z.number().int().min(0).max(1_000_000_000),
  duration_minutes: z.number().int().min(15).max(1440).nullable().optional(),
});

const updateServiceSchema = serviceSchema.partial().extend({
  is_active: z.boolean().optional(),
});

const portfolioSchema = z.object({
  media_url: z.string().url().max(2048),
  title: z.string().trim().max(120).nullable().optional(),
  sort_order: z.number().int().min(0).max(1000).optional(),
});

const verificationSchema = z.object({
  id_type: z.enum(['nin', 'passport', 'drivers_license', 'voter_card', 'other']),
  id_number_last4: z.string().regex(/^\d{4}$/).optional(),
  selfie_url: z.string().url().max(2048),
  certificate_url: z.string().url().max(2048).optional(),
  references: z.array(z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(7).max(20),
    relationship: z.string().trim().max(80).optional(),
  })).max(5).default([]),
  notes: z.string().trim().max(1000).optional(),
});

const workerIdParamSchema = z.object({ id: z.string().uuid() });
const serviceIdParamSchema = z.object({ serviceId: z.string().uuid() });
const itemIdParamSchema = z.object({ itemId: z.string().uuid() });

function workerOnly(req, _res, next) {
  try {
    assertWorker(req.user);
    next();
  } catch (error) {
    next(error);
  }
}

workersRouter.get('/nearby', validate(nearbyQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const workers = await nearbyWorkers(req.query);
  res.json({ data: workers, meta: { count: workers.length } });
}));

workersRouter.get('/me', requireAuth, workerOnly, asyncHandler(async (req, res) => {
  const profile = await getMyWorkerProfile(req.user.id);
  res.json({ data: profile });
}));

workersRouter.patch('/me', requireAuth, workerOnly, validate(updateProfileSchema), asyncHandler(async (req, res) => {
  const profile = await updateMyWorkerProfile(req.user.id, req.body);
  res.json({ data: profile });
}));

workersRouter.put('/me/availability', requireAuth, workerOnly, validate(availabilitySchema), asyncHandler(async (req, res) => {
  const profile = await setAvailability(req.user.id, req.body);
  res.json({ data: profile });
}));

workersRouter.post('/me/services', requireAuth, workerOnly, validate(serviceSchema), asyncHandler(async (req, res) => {
  const service = await createService(req.user.id, req.body);
  res.status(201).json({ data: service });
}));

workersRouter.patch('/me/services/:serviceId', requireAuth, workerOnly, validate(serviceIdParamSchema, 'params'), validate(updateServiceSchema), asyncHandler(async (req, res) => {
  const service = await updateService(req.user.id, req.params.serviceId, req.body);
  res.json({ data: service });
}));

workersRouter.delete('/me/services/:serviceId', requireAuth, workerOnly, validate(serviceIdParamSchema, 'params'), asyncHandler(async (req, res) => {
  await deactivateService(req.user.id, req.params.serviceId);
  res.status(204).send();
}));

workersRouter.post('/me/portfolio', requireAuth, workerOnly, validate(portfolioSchema), asyncHandler(async (req, res) => {
  const item = await addPortfolioItem(req.user.id, req.body);
  res.status(201).json({ data: item });
}));

workersRouter.delete('/me/portfolio/:itemId', requireAuth, workerOnly, validate(itemIdParamSchema, 'params'), asyncHandler(async (req, res) => {
  await removePortfolioItem(req.user.id, req.params.itemId);
  res.status(204).send();
}));

workersRouter.post('/me/verification', requireAuth, workerOnly, validate(verificationSchema), asyncHandler(async (req, res) => {
  const submission = await submitVerification(req.user.id, req.body);
  res.status(201).json({ data: submission });
}));

workersRouter.get('/me/verification', requireAuth, workerOnly, asyncHandler(async (req, res) => {
  const submission = await getMyVerification(req.user.id);
  res.json({ data: submission });
}));

workersRouter.get('/:id', optionalAuth, validate(workerIdParamSchema, 'params'), asyncHandler(async (req, res) => {
  const worker = await getPublicWorker(req.params.id, req.user ?? null);
  res.json({ data: worker });
}));
