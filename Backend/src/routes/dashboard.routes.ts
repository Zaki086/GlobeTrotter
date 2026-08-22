import { Router } from 'express';
import * as controller from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.get('/', authenticate, controller.getDashboard);

export default router;
