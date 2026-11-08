import { Router } from 'express';
import { query } from '../lib/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const healthRouter = Router();

healthRouter.get('/live', (_req, res) => {
  res.json({ status: 'ok', app: 'skilllink-backend', time: new Date().toISOString() });
});

healthRouter.get('/ready', asyncHandler(async (_req, res) => {
  try {
    await query('select 1');
    res.json({ status: 'ready', database: 'ok' });
  } catch (error) {
    console.error('Readiness check failed', error);
    res.status(503).json({ status: 'unavailable', database: 'error' });
  }
}));

healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', app: 'skilllink-backend' });
});
