import { Router } from 'express';
import authRoutes from './auth.routes.js';
import chatRoutes from './chat.routes.js';
import conversationRoutes from './conversation.routes.js';
import fileRoutes from './file.routes.js';
import { searchRouter, researchRouter } from './search.routes.js';
import userRoutes from './user.routes.js';
import adminRoutes from './admin.routes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/chat', chatRoutes);
apiRouter.use('/conversations', conversationRoutes);
apiRouter.use('/files', fileRoutes);
apiRouter.use('/', searchRouter);
apiRouter.use('/', researchRouter);
apiRouter.use('/', userRoutes);
apiRouter.use('/admin', adminRoutes);

export default apiRouter;
