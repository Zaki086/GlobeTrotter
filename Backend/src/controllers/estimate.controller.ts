import { sendSuccess } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { EstimateService } from '../services/estimate.service';
import type { EstimateStopQuery } from '../validators/estimate.validator';

/** What one city will cost, given dates, party size and comfort level. */
export const estimateStop = asyncHandler(async (req, res) => {
  const query = req.query as never as EstimateStopQuery;
  const estimate = await EstimateService.estimateStop(query);
  return sendSuccess(res, estimate, 'Estimate calculated');
});

/** Prices a whole prospective route before any of it is saved. */
export const estimateRoute = asyncHandler(async (req, res) => {
  const estimate = await EstimateService.estimateRoute(req.body);
  return sendSuccess(res, estimate, 'Route estimate calculated');
});
