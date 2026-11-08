import { Router } from 'express';
import { query } from '../lib/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const tradesRouter = Router();

tradesRouter.get('/', asyncHandler(async (_req, res) => {
  const result = await query(
    `select id, slug, name, icon, sort_order
     from public.trades
     where is_active = true
     order by sort_order asc, name asc`,
  );
  res.json({ data: result.rows, meta: { count: result.rows.length } });
}));
