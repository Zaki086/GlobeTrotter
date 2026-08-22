import { Router } from 'express';
import { z } from 'zod';
import * as tripController from '../controllers/trip.controller';
import * as stopController from '../controllers/stop.controller';
import * as budgetController from '../controllers/budget.controller';
import * as shareController from '../controllers/share.controller';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { rateLimiters } from '../middleware/rateLimiter';
import { uuid } from '../validators/common.validator';
import {
  addMemberSchema,
  calendarQuerySchema,
  createTripSchema,
  itineraryQuerySchema,
  listTripsQuerySchema,
  tripIdParamSchema,
  updateTripSchema,
} from '../validators/trip.validator';
import { createStopSchema } from '../validators/stop.validator';
import {
  createExpenseSchema,
  listExpensesQuerySchema,
  updateBudgetSchema,
} from '../validators/budget.validator';
import { createShareSchema } from '../validators/share.validator';

const router = Router();

// Every trip route requires a signed-in user.
router.use(authenticate);

// --- Trips -----------------------------------------------------------------
router.post('/', rateLimiters.createTrip, validate({ body: createTripSchema }), tripController.createTrip);
router.get('/', validate({ query: listTripsQuerySchema }), tripController.listTrips);
router.get('/:id', validate({ params: tripIdParamSchema }), tripController.getTrip);
router.patch(
  '/:id',
  rateLimiters.write,
  validate({ params: tripIdParamSchema, body: updateTripSchema }),
  tripController.updateTrip,
);
router.delete('/:id', validate({ params: tripIdParamSchema }), tripController.deleteTrip);

// --- Itinerary, calendar ---------------------------------------------------
router.get(
  '/:id/itinerary',
  validate({ params: tripIdParamSchema, query: itineraryQuerySchema }),
  tripController.getItinerary,
);
router.get(
  '/:id/calendar',
  validate({ params: tripIdParamSchema, query: calendarQuerySchema }),
  tripController.getCalendar,
);

// --- Stops -----------------------------------------------------------------
router.get('/:id/stops', validate({ params: tripIdParamSchema }), tripController.listTripStops);
router.post(
  '/:id/stops',
  rateLimiters.write,
  validate({ params: tripIdParamSchema, body: createStopSchema }),
  stopController.createStop,
);

// --- Budget & expenses -----------------------------------------------------
router.get('/:id/budget', validate({ params: tripIdParamSchema }), budgetController.getBudget);
router.patch(
  '/:id/budget',
  rateLimiters.write,
  validate({ params: tripIdParamSchema, body: updateBudgetSchema }),
  budgetController.updateBudget,
);
router.get(
  '/:id/expenses',
  validate({ params: tripIdParamSchema, query: listExpensesQuerySchema }),
  budgetController.listExpenses,
);
router.post(
  '/:id/expenses',
  rateLimiters.write,
  validate({ params: tripIdParamSchema, body: createExpenseSchema }),
  budgetController.createExpense,
);
router.delete(
  '/:id/expenses/:expenseId',
  validate({ params: z.object({ id: uuid, expenseId: uuid }) }),
  budgetController.deleteExpense,
);

// --- Sharing ---------------------------------------------------------------
router.post(
  '/:id/share',
  rateLimiters.share,
  validate({ params: tripIdParamSchema, body: createShareSchema }),
  shareController.createShareLink,
);
router.get('/:id/share', validate({ params: tripIdParamSchema }), shareController.listShareLinks);
router.delete(
  '/:id/share/:shareId',
  validate({ params: z.object({ id: uuid, shareId: uuid }) }),
  shareController.revokeShareLink,
);

// --- Collaboration ---------------------------------------------------------
router.post(
  '/:id/members',
  rateLimiters.write,
  validate({ params: tripIdParamSchema, body: addMemberSchema }),
  tripController.addTripMember,
);
router.delete(
  '/:id/members/:memberId',
  validate({ params: z.object({ id: uuid, memberId: uuid }) }),
  tripController.removeTripMember,
);

export default router;
