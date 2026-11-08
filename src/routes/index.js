import { Router } from 'express';
import { adminRouter } from './admin.js';
import { authRouter } from './auth.js';
import { bookingsRouter } from './bookings.js';
import { healthRouter } from './health.js';
import { tradesRouter } from './trades.js';
import { usersRouter } from './users.js';
import { workersRouter } from './workers.js';

export const apiRouter = Router();

apiRouter.get('/', (_req, res) => {
  res.json({
    name: 'SkillLink API',
    version: 'v1',
    docs: '/docs',
  });
});

apiRouter.use('/health', healthRouter);
apiRouter.use('/trades', tradesRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/workers', workersRouter);
apiRouter.use('/bookings', bookingsRouter);
apiRouter.use('/admin', adminRouter);
