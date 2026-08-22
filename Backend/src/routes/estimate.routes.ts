import { Router } from 'express';
import * as controller from '../controllers/estimate.controller';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { rateLimiters } from '../middleware/rateLimiter';
import { estimateRouteSchema, estimateStopSchema } from '../validators/estimate.validator';

const router = Router();

router.use(authenticate);

router.get('/stop', rateLimiters.search, validate({ query: estimateStopSchema }), controller.estimateStop);
router.post('/route', rateLimiters.search, validate({ body: estimateRouteSchema }), controller.estimateRoute);

export default router;
