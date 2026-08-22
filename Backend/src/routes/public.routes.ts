import { Router } from 'express';
import * as controller from '../controllers/share.controller';
import { authenticate, optionalAuth } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { rateLimiters } from '../middleware/rateLimiter';
import { copyTripSchema, shareSlugParamSchema } from '../validators/share.validator';

const router = Router();

/**
 * Public share surface.
 *
 * GET is strictly read-only and open to anyone with the link — optionalAuth
 * only lets the response know whether the viewer could copy the trip.
 * POST /copy writes into an account, so it demands real authentication.
 */
router.get(
  '/:slug',
  rateLimiters.publicRead,
  optionalAuth,
  validate({ params: shareSlugParamSchema }),
  controller.getPublicItinerary,
);

router.post(
  '/:slug/copy',
  authenticate,
  rateLimiters.copyTrip,
  validate({ params: shareSlugParamSchema, body: copyTripSchema }),
  controller.copyPublicItinerary,
);

export default router;
