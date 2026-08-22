import { Router } from 'express';
import * as controller from '../controllers/city.controller';
import { optionalAuth } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { rateLimiters } from '../middleware/rateLimiter';
import { cityIdParamSchema, listCitiesQuerySchema } from '../validators/city.validator';

const router = Router();

// Browsing the city catalog works signed out; optionalAuth just gives the
// rate limiter a per-user bucket when a token is present.
router.use(optionalAuth);

// Literal paths first so they are not captured by "/:id".
router.get('/facets', controller.getCityFacets);
router.get('/popular', rateLimiters.search, controller.getPopularCities);

router.get('/', rateLimiters.search, validate({ query: listCitiesQuerySchema }), controller.searchCities);
router.get('/:id', validate({ params: cityIdParamSchema }), controller.getCity);

export default router;
