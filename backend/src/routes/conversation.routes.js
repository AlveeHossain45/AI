import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { conversationController } from '../controllers/conversationController.js';
import {
  conversationCreateSchema,
  conversationUpdateSchema,
  idParamSchema,
  paginationQuery,
  exportSchema,
  folderSchema,
} from '../validators/schemas.js';

const router = Router();
router.use(requireAuth);

router.get('/', validate(paginationQuery), conversationController.list);
router.post('/', validate(conversationCreateSchema), conversationController.create);
router.get('/:id', validate(idParamSchema), conversationController.get);
router.patch('/:id', validate(conversationUpdateSchema), conversationController.update);
router.delete('/:id', validate(idParamSchema), conversationController.remove);
router.get('/:id/messages', validate(idParamSchema), conversationController.messages);
router.get('/:id/export', validate(exportSchema), conversationController.export);

router.get('/meta/folders/list', conversationController.folders.list);
router.post('/meta/folders', validate(folderSchema), conversationController.folders.create);
router.patch('/meta/folders/:id', conversationController.folders.update);
router.delete('/meta/folders/:id', validate(idParamSchema), conversationController.folders.remove);

export default router;
