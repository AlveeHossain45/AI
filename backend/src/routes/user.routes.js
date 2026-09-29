import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { feedbackController, userController } from '../controllers/userController.js';
import { feedbackSchema, preferencesSchema, idParamSchema } from '../validators/schemas.js';

const router = Router();
router.use(requireAuth);

router.post('/feedback', validate(feedbackSchema), feedbackController.create);
router.delete('/feedback/:messageId', feedbackController.remove);

router.get('/user/settings', userController.preferences);
router.patch('/user/settings', validate(preferencesSchema), userController.updatePreferences);
router.get('/user/usage', userController.usage);
router.get('/user/stats', userController.stats);

export default router;
