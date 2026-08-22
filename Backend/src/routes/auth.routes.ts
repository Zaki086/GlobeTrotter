import { Router } from 'express';
import * as controller from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { rateLimiters } from '../middleware/rateLimiter';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  resetPasswordSchema,
  signupSchema,
} from '../validators/auth.validator';

const router = Router();

// Public — each carries the specific limit mandated by the spec.
router.post('/signup', rateLimiters.signup, validate({ body: signupSchema }), controller.signup);
router.post('/login', rateLimiters.login, validate({ body: loginSchema }), controller.login);
router.post('/refresh', rateLimiters.refresh, validate({ body: refreshSchema }), controller.refresh);

router.post(
  '/forgot-password',
  rateLimiters.forgotPassword,
  validate({ body: forgotPasswordSchema }),
  controller.forgotPassword,
);
router.post(
  '/reset-password',
  rateLimiters.forgotPassword,
  validate({ body: resetPasswordSchema }),
  controller.resetPassword,
);

// Authenticated
router.post('/logout', authenticate, validate({ body: logoutSchema }), controller.logout);
router.post('/logout-all', authenticate, controller.logoutAll);
router.get('/me', authenticate, controller.me);
router.get('/sessions', authenticate, controller.listSessions);
router.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  controller.changePassword,
);

export default router;
