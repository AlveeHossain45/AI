import { Router } from 'express';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { authController } from '../controllers/authController.js';
import { registerSchema, loginSchema, forgotSchema, resetSchema, verifyEmailSchema, googleAuthSchema } from '../validators/schemas.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/logout', authController.logout);
router.get('/me', optionalAuth, authController.me);
router.post('/refresh', optionalAuth, authController.refresh);
router.post('/forgot-password', authLimiter, validate(forgotSchema), authController.forgotPassword);
router.post('/reset-password', authLimiter, validate(resetSchema), authController.resetPassword);
router.post('/verify-email', authLimiter, validate(verifyEmailSchema), authController.verifyEmail);
router.post('/google', authLimiter, validate(googleAuthSchema), authController.google);
router.post('/change-password', requireAuth, authController.changePassword);

export default router;
