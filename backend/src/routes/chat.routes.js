import { Router } from 'express';
import { chatLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { chatController } from '../controllers/chatController.js';
import { chatStreamSchema } from '../validators/schemas.js';

const router = Router();

router.use(requireAuth);
router.get('/providers', chatController.providers);
router.post('/', chatLimiter, validate(chatStreamSchema), chatController.create);
router.post('/stream', chatLimiter, validate(chatStreamSchema), chatController.stream);

export default router;
