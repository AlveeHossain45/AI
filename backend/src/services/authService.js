/**
 * Authentication service: email/password, email verification, password
 * reset, and optional Google OAuth (ID token verification).
 */
import bcrypt from 'bcryptjs';
import config from '../config/index.js';
import { userRepo } from '../repositories/userRepo.js';
import { tokenRepo } from '../repositories/settingRepo.js';
import { signToken } from '../middleware/auth.js';
import { sendEmail } from './emailService.js';
import { badRequest, conflict, unauthorized, notFound, serviceUnavailable } from '../utils/errors.js';
import { randomToken, sha256 } from '../utils/crypto.js';
import { requestJson } from '../utils/http.js';
import { getGlobalSettings } from './settingsService.js';

const SALT_ROUNDS = 12;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

export const toPublicUser = (user) => {
  if (!user) return null;
  const { passwordHash, googleId, ...rest } = user;
  void googleId;
  return rest;
};

export async function register ({ email, password, name }) {
  const settings = await getGlobalSettings();
  if (!settings.allow_registration) throw badRequest('Registration is currently disabled. Please contact an administrator.');
  const existing = await userRepo.findByEmail(email);
  if (existing) throw conflict('An account with this email already exists. Try signing in instead.');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await userRepo.create({
    email,
    passwordHash,
    name: name || email.split('@')[0],
    role: 'USER',
    emailVerifiedAt: null,
  });

  await issueVerification(user);
  return toPublicUser(user);
}

export async function login ({ email, password }) {
  const user = await userRepo.findByEmail(email);
  if (!user?.passwordHash) throw unauthorized('Incorrect email or password.');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw unauthorized('Incorrect email or password.');
  if (user.isSuspended) throw unauthorized('This account has been suspended.');

  await userRepo.update(user.id, { lastLoginAt: new Date() }).catch(() => {});
  return { user: toPublicUser(user), token: signToken(user) };
}

export async function issueVerification (user) {
  const token = randomToken(32);
  await tokenRepo.invalidateFor(user.id, 'EMAIL_VERIFY').catch(() => {});
  await tokenRepo.create({
    userId: user.id,
    purpose: 'EMAIL_VERIFY',
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
  });
  const result = await sendEmail({
    to: user.email,
    subject: 'Verify your NovaAI email',
    text: 'Confirm your email address to activate your NovaAI account.',
    path: `/verify-email?token=${token}`,
  });
  return { token, ...result };
}

export async function verifyEmail (token) {
  const record = await tokenRepo.findValid(sha256(token), 'EMAIL_VERIFY');
  if (!record?.user) throw badRequest('This verification link is invalid or has expired.');
  await userRepo.update(record.user.id, { emailVerifiedAt: new Date() });
  await tokenRepo.markUsed(record.id);
  return toPublicUser(await userRepo.findById(record.user.id));
}

export async function requestPasswordReset (email) {
  const user = await userRepo.findByEmail(email);
  // Always report success to avoid leaking which emails exist.
  if (!user) return { delivered: false };
  const token = randomToken(32);
  await tokenRepo.invalidateFor(user.id, 'PASSWORD_RESET').catch(() => {});
  await tokenRepo.create({
    userId: user.id,
    purpose: 'PASSWORD_RESET',
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  });
  const result = await sendEmail({
    to: user.email,
    subject: 'Reset your NovaAI password',
    text: 'Use this link to choose a new password. The link expires in 1 hour.',
    path: `/reset-password?token=${token}`,
  });
  return result;
}

export async function resetPassword ({ token, password }) {
  const record = await tokenRepo.findValid(sha256(token), 'PASSWORD_RESET');
  if (!record?.user) throw badRequest('This reset link is invalid or has expired.');
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await userRepo.update(record.user.id, { passwordHash });
  await tokenRepo.markUsed(record.id);
  return toPublicUser(await userRepo.findById(record.user.id));
}

/** Google Sign-In: verify the ID token against Google's tokeninfo endpoint. */
export async function googleLogin (credential) {
  if (!config.auth.googleClientId) {
    throw serviceUnavailable('Google sign-in is not configured on this server (set GOOGLE_CLIENT_ID).');
  }
  let payload;
  try {
    const data = await requestJson(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      { method: 'GET' },
      { timeoutMs: 10000 }
    );
    payload = data;
  } catch {
    throw unauthorized('Google sign-in failed. Please try again.');
  }
  if (payload.aud !== config.auth.googleClientId) throw unauthorized('Google token audience mismatch.');
  if (payload.email_verified !== 'true' && payload.email_verified !== true) throw unauthorized('Google account email is not verified.');

  let user = await userRepo.findByGoogleId(payload.sub);
  if (!user) {
    user = await userRepo.findByEmail(payload.email).catch(() => null);
    if (user) {
      user = await userRepo.update(user.id, { googleId: payload.sub, emailVerifiedAt: new Date() });
    } else {
      user = await userRepo.create({
        email: payload.email,
        googleId: payload.sub,
        name: payload.name || payload.email.split('@')[0],
        avatarUrl: payload.picture || null,
        emailVerifiedAt: new Date(),
        passwordHash: null,
      });
    }
  }
  await userRepo.update(user.id, { lastLoginAt: new Date() }).catch(() => {});
  return { user: toPublicUser(user), token: signToken(user) };
}

export async function changePassword (user, { currentPassword, newPassword }) {
  const record = await userRepo.findById(user.id);
  if (!record?.passwordHash) throw badRequest('This account uses Google sign-in and has no password.');
  const ok = await bcrypt.compare(currentPassword, record.passwordHash);
  if (!ok) throw unauthorized('Your current password is incorrect.');
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await userRepo.update(user.id, { passwordHash });
  return true;
}

export const requireExistingUser = (user) => {
  if (!user) throw notFound('User not found.');
  return user;
};

export default { register, login, verifyEmail, requestPasswordReset, resetPassword, googleLogin, changePassword, toPublicUser };
