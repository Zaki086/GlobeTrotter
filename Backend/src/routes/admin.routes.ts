import { Router } from 'express';
import * as controller from '../controllers/admin.controller';
import * as content from '../controllers/adminContent.controller';
import { authenticate, authorize } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import {
  analyticsQuerySchema,
  listAuditLogsQuerySchema,
  listUsersQuerySchema,
  updateUserSchema,
  userIdParamSchema,
} from '../validators/admin.validator';

const router = Router();

// Admin-only for every route below.
router.use(authenticate, authorize('ADMIN'));

router.get('/analytics', validate({ query: analyticsQuerySchema }), controller.getAnalytics);

router.get('/users', validate({ query: listUsersQuerySchema }), controller.listUsers);
router.get('/users/:userId', validate({ params: userIdParamSchema }), controller.getUser);
router.patch(
  '/users/:userId',
  validate({ params: userIdParamSchema, body: updateUserSchema }),
  controller.updateUser,
);

router.get('/audit-logs', validate({ query: listAuditLogsQuerySchema }), controller.listAuditLogs);

// Content oversight — trips, community posts and the destination catalog.
router.get('/trips', content.listAllTrips);
router.get('/posts', content.listAllPosts);
router.get('/catalog', content.listCatalog);
router.patch('/catalog/:cityId/rates', content.updateCityRates);

export default router;
