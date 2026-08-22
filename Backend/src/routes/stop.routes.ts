import { Router } from 'express';
import * as controller from '../controllers/stop.controller';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { rateLimiters } from '../middleware/rateLimiter';
import {
  reorderStopsSchema,
  stopIdParamSchema,
  updateStopSchema,
} from '../validators/stop.validator';
import {
  addStopActivitySchema,
  stopActivityParamsSchema,
  updateStopActivitySchema,
} from '../validators/activity.validator';

const router = Router();

router.use(authenticate);

// Declared before "/:id" so the literal path is not captured as an id.
router.patch(
  '/reorder',
  rateLimiters.write,
  validate({ body: reorderStopsSchema }),
  controller.reorderStops,
);

router.get('/:id', validate({ params: stopIdParamSchema }), controller.getStop);
router.patch(
  '/:id',
  rateLimiters.write,
  validate({ params: stopIdParamSchema, body: updateStopSchema }),
  controller.updateStop,
);
router.delete('/:id', validate({ params: stopIdParamSchema }), controller.deleteStop);

// --- Activities scheduled into this stop ------------------------------------
router.get('/:id/activities', validate({ params: stopIdParamSchema }), controller.listStopActivities);
router.post(
  '/:id/activities',
  rateLimiters.addActivity,
  validate({ params: stopIdParamSchema, body: addStopActivitySchema }),
  controller.addStopActivity,
);
router.patch(
  '/:id/activities/:activityId',
  rateLimiters.addActivity,
  validate({ params: stopActivityParamsSchema, body: updateStopActivitySchema }),
  controller.updateStopActivity,
);
router.delete(
  '/:id/activities/:activityId',
  validate({ params: stopActivityParamsSchema }),
  controller.removeStopActivity,
);

export default router;
