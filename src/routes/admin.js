import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listUsers,
  listVerifications,
  overview,
  reviewVerification,
  setUserStatus,
} from '../services/adminService.js';
import { listBookings } from '../services/bookingService.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('admin'));

const workerIdParamSchema = z.object({ workerId: z.string().uuid() });
const userIdParamSchema = z.object({ id: z.string().uuid() });

const verificationQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional().default('pending'),
});

const verificationDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(1000).optional(),
});

const usersQuerySchema = z.object({
  role: z.enum(['client', 'worker', 'admin']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const userStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
  reason: z.string().trim().max(500).optional(),
});

const bookingsQuerySchema = z.object({
  status: z.enum([
    'requested', 'accepted', 'en_route', 'arrived', 'in_progress',
    'completed', 'cancelled', 'declined', 'expired',
  ]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

adminRouter.get('/overview', asyncHandler(async (_req, res) => {
  const stats = await overview();
  res.json({ data: stats });
}));

adminRouter.get('/verifications', validate(verificationQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const submissions = await listVerifications(req.query.status);
  res.json({ data: submissions, meta: { count: submissions.length, status: req.query.status } });
}));

adminRouter.post('/workers/:workerId/verification', validate(workerIdParamSchema, 'params'), validate(verificationDecisionSchema), asyncHandler(async (req, res) => {
  const result = await reviewVerification(
    req.params.workerId,
    req.user.id,
    req.body.decision,
    req.body.note,
  );
  res.json({ data: result });
}));

adminRouter.get('/users', validate(usersQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const users = await listUsers(req.query);
  res.json({ data: users, meta: { count: users.length } });
}));

adminRouter.patch('/users/:id/status', validate(userIdParamSchema, 'params'), validate(userStatusSchema), asyncHandler(async (req, res) => {
  const user = await setUserStatus(req.params.id, req.user.id, req.body.status, req.body.reason);
  res.json({ data: user });
}));

adminRouter.get('/bookings', validate(bookingsQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const bookings = await listBookings(req.user, req.query);
  res.json({ data: bookings, meta: { count: bookings.length } });
}));
