import { sendSuccess } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { DashboardService } from '../services/dashboard.service';

export const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await DashboardService.get(req.auth!.userId);
  return sendSuccess(res, dashboard, 'Dashboard retrieved');
});
