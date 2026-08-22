import { buildPaginationMeta, sendSuccess } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { ActivityService } from '../services/activity.service';
import type { ListActivitiesQuery } from '../validators/activity.validator';

export const searchActivities = asyncHandler(async (req, res) => {
  const query = req.query as never as ListActivitiesQuery;
  const { items, total } = await ActivityService.search(query);
  return sendSuccess(
    res,
    items,
    'Activities retrieved',
    200,
    buildPaginationMeta(query.page, query.limit, total),
  );
});

export const getActivity = asyncHandler(async (req, res) => {
  const activity = await ActivityService.getById(req.params.id);
  return sendSuccess(res, activity, 'Activity retrieved');
});

export const getPopularActivities = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit ?? 10);
  const activities = await ActivityService.popular(Math.min(Math.max(limit, 1), 50));
  return sendSuccess(res, activities, 'Popular activities retrieved');
});
