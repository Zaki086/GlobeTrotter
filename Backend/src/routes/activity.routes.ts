import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/activity.controller';
import { optionalAuth } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { rateLimiters } from '../middleware/rateLimiter';
import { uuid } from '../validators/common.validator';
import { listActivitiesQuerySchema } from '../validators/activity.validator';

const router = Router();

router.use(optionalAuth);

router.get('/popular', rateLimiters.search, controller.getPopularActivities);

router.get(
  '/',
  rateLimiters.search,
  validate({ query: listActivitiesQuerySchema }),
  controller.searchActivities,
);
router.get('/:id', validate({ params: z.object({ id: uuid }) }), controller.getActivity);

export default router;
