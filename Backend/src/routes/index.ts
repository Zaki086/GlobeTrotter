import { Router } from 'express';
import { prisma } from '../config/prisma';
import { pingRedis } from '../config/redis';
import { env } from '../config/env';
import { sendSuccess, sendFailure } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

import authRoutes from './auth.routes';
import dashboardRoutes from './dashboard.routes';
import tripRoutes from './trip.routes';
import stopRoutes from './stop.routes';
import cityRoutes from './city.routes';
import activityRoutes from './activity.routes';
import profileRoutes from './profile.routes';
import publicRoutes from './public.routes';
import adminRoutes from './admin.routes';
import communityRoutes from './community.routes';
import estimateRoutes from './estimate.routes';

const router = Router();

/**
 * Liveness + readiness. Reports degraded (503) when a dependency is down so
 * an orchestrator can pull the instance out of rotation.
 */
router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const [database, redisOk] = await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      pingRedis(),
    ]);

    const healthy = database && redisOk;
    const payload = {
      status: healthy ? 'ok' : 'degraded',
      uptimeSeconds: Math.floor(process.uptime()),
      environment: env.NODE_ENV,
      version: process.env.npm_package_version ?? '1.0.0',
      dependencies: {
        database: database ? 'up' : 'down',
        redis: redisOk ? 'up' : 'down',
      },
      timestamp: new Date().toISOString(),
    };

    return healthy
      ? sendSuccess(res, payload, 'Service is healthy')
      : res.status(503).json({ success: false, message: 'Service is degraded', data: payload });
  }),
);

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/trips', tripRoutes);
router.use('/stops', stopRoutes);
router.use('/cities', cityRoutes);
router.use('/activities', activityRoutes);
router.use('/profile', profileRoutes);
router.use('/public', publicRoutes);
router.use('/community', communityRoutes);
router.use('/estimates', estimateRoutes);
router.use('/admin', adminRoutes);

export default router;
export { sendFailure };
