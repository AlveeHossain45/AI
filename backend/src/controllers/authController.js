/**
 * Auth controller: signup, login, logout, session, verification, reset.
 */
import { asyncHandler } from '../utils/crypto.js';
import { unauthorized, badRequest } from '../utils/errors.js';
import { userRepo } from '../repositories/userRepo.js';
import {
  register, login, verifyEmail, requestPasswordReset, resetPassword, googleLogin, changePassword, toPublicUser,
} from '../services/authService.js';
import { signToken, setAuthCookie, clearAuthCookie, requireAuth } from '../middleware/auth.js';
import { usageRepo } from '../repositories/usageRepo.js';

export const authController = {
  register: asyncHandler(async (req, res) => {
    const user = await register(req.body);
    const full = await userRepo.findByEmail(req.body.email);
    const token = signToken(full);
    setAuthCookie(res, token);
    res.status(201).json({ user, token });
  }),

  login: asyncHandler(async (req, res) => {
    const { user, token } = await login(req.body);
    setAuthCookie(res, token);
    res.json({ user, token });
  }),

  logout: asyncHandler(async (req, res) => {
    clearAuthCookie(res);
    res.json({ ok: true });
  }),

  me: asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized('Not signed in.');
    const [usage] = await Promise.all([usageRepo.userUsage(req.user.id, { days: 30 })]);
    res.json({ user: toPublicUser(req.user), usage });
  }),

  forgotPassword: asyncHandler(async (req, res) => {
    const result = await requestPasswordReset(req.body.email);
    res.json({
      ok: true,
      message: 'If that email exists, a reset link has been sent.',
      // Development convenience when no SMTP server is configured.
      ...(result?.devUrl ? { devUrl: result.devUrl } : {}),
    });
  }),

  resetPassword: asyncHandler(async (req, res) => {
    await resetPassword(req.body);
    res.json({ ok: true, message: 'Your password has been updated. You can sign in now.' });
  }),

  verifyEmail: asyncHandler(async (req, res) => {
    const user = await verifyEmail(req.body.token);
    res.json({ ok: true, user });
  }),

  google: asyncHandler(async (req, res) => {
    const { user, token } = await googleLogin(req.body.credential);
    setAuthCookie(res, token);
    res.json({ user, token });
  }),

  changePassword: asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) throw badRequest('currentPassword and newPassword are required.');
    if (String(newPassword).length < 8) throw badRequest('New password must be at least 8 characters.');
    await changePassword(req.user, { currentPassword, newPassword: String(newPassword).slice(0, 128) });
    res.json({ ok: true });
  }),

  refresh: asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized('Not signed in.');
    const token = signToken(req.user);
    setAuthCookie(res, token);
    res.json({ user: toPublicUser(req.user), token });
  }),
};

export { requireAuth };
export default authController;
