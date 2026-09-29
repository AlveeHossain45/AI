import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { uploadMiddleware } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { fileController } from '../controllers/fileController.js';
import { idParamSchema, paginationQuery } from '../validators/schemas.js';

const router = Router();
router.use(requireAuth);

router.post('/', uploadLimiter, uploadMiddleware.array('files', 5), fileController.upload);
router.get('/', validate(paginationQuery), fileController.list);
router.get('/:id', validate(idParamSchema), fileController.get);
router.get('/:id/raw', validate(idParamSchema), fileController.raw);
router.delete('/:id', validate(idParamSchema), fileController.remove);

export default router;
