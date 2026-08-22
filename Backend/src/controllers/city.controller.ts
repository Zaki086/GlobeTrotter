import { buildPaginationMeta, sendSuccess } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { CityService } from '../services/city.service';
import type { ListCitiesQuery } from '../validators/city.validator';

export const searchCities = asyncHandler(async (req, res) => {
  const query = req.query as never as ListCitiesQuery;
  const { items, total } = await CityService.search(query);
  return sendSuccess(
    res,
    items,
    'Cities retrieved',
    200,
    buildPaginationMeta(query.page, query.limit, total),
  );
});

export const getCity = asyncHandler(async (req, res) => {
  const city = await CityService.getById(req.params.id);
  return sendSuccess(res, city, 'City retrieved');
});

/** Distinct countries and regions for the search filter dropdowns. */
export const getCityFacets = asyncHandler(async (_req, res) => {
  const facets = await CityService.facets();
  return sendSuccess(res, facets, 'City filters retrieved');
});

export const getPopularCities = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit ?? 10);
  const cities = await CityService.popular(Math.min(Math.max(limit, 1), 50));
  return sendSuccess(res, cities, 'Popular cities retrieved');
});
