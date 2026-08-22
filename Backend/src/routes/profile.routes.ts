import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/profile.controller';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { rateLimiters } from '../middleware/rateLimiter';
import { uuid } from '../validators/common.validator';
import {
  deleteProfileSchema,
  listNotificationsQuerySchema,
  savedDestinationParamSchema,
  updateProfileSchema,
} from '../validators/profile.validator';

const router = Router();

router.use(authenticate);

router.get('/', controller.getProfile);
router.patch('/', rateLimiters.write, validate({ body: updateProfileSchema }), controller.updateProfile);
router.delete('/', validate({ body: deleteProfileSchema }), controller.deleteProfile);

// --- Saved destinations ----------------------------------------------------
router.post(
  '/saved-destinations/:cityId',
  rateLimiters.write,
  validate({ params: savedDestinationParamSchema }),
  controller.addSavedDestination,
);
router.delete(
  '/saved-destinations/:cityId',
  validate({ params: savedDestinationParamSchema }),
  controller.removeSavedDestination,
);

// --- Notifications ---------------------------------------------------------
router.get(
  '/notifications',
  validate({ query: listNotificationsQuerySchema }),
  controller.listNotifications,
);
router.patch('/notifications/read-all', controller.markAllNotificationsRead);
router.patch(
  '/notifications/:id',
  validate({ params: z.object({ id: uuid }) }),
  controller.markNotificationRead,
);

export default router;
