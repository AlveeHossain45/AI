import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { searchController, researchController } from '../controllers/searchController.js';
import { searchSchema, researchSchema } from '../validators/schemas.js';

const searchRouter = Router();
searchRouter.post('/search', optionalAuth, validate(searchSchema), searchController.search);
searchRouter.get('/search/recent', requireAuth, searchController.recent);

const researchRouter = Router();
researchRouter.use(requireAuth);
researchRouter.post('/research', validate(researchSchema), researchController.research);
researchRouter.post('/research/stream', validate(researchSchema), researchController.stream);

export { searchRouter, researchRouter };
export default { searchRouter, researchRouter };
