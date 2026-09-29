import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { adminController } from '../controllers/adminController.js';
import { adminSettingsSchema, adminUserUpdateSchema, paginationQuery } from '../validators/schemas.js';

const router = Router();
router.use(requireAdmin);

router.get('/analytics', adminController.analytics);
router.get('/users', validate(paginationQuery), adminController.users);
router.patch('/users/:id', validate(adminUserUpdateSchema), adminController.updateUser);
router.get('/settings', adminController.getSettings);
router.patch('/settings', validate(adminSettingsSchema), adminController.updateSettings);
router.get('/system', adminController.system);
router.post('/system/reload-providers', adminController.reloadProviders);

export default router;
