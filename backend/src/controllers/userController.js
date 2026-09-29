/**
 * Feedback + user preference controllers.
 */
import { asyncHandler } from '../utils/crypto.js';
import { notFound, badRequest } from '../utils/errors.js';
import { feedbackRepo } from '../repositories/settingRepo.js';
import { messageRepo } from '../repositories/conversationRepo.js';
import { getUserPreferences, setUserPreferences } from '../services/settingsService.js';
import { usageRepo } from '../repositories/usageRepo.js';

export const feedbackController = {
  create: asyncHandler(async (req, res) => {
    const { messageId, rating, comment } = req.body;
    const message = await messageRepo.findById(messageId);
    if (!message) throw notFound('Message not found.');
    if (message.role !== 'ASSISTANT') throw badRequest('Feedback can only be left on AI answers.');
    const row = await feedbackRepo.upsert({ userId: req.user.id, messageId, rating, comment });
    res.status(201).json({ feedback: { id: row.id, rating: row.rating } });
  }),

  remove: asyncHandler(async (req, res) => {
    const message = await messageRepo.findById(req.params.messageId);
    if (!message) throw notFound('Message not found.');
    const rows = await feedbackRepo.forMessage(message.id);
    const mine = rows.find((row) => row.userId === req.user.id);
    if (!mine) throw notFound('Feedback not found.');
    const { settingRepo } = await import('../repositories/settingRepo.js');
    void settingRepo;
    const { getPrisma, isPostgres, memory } = await import('../db/index.js');
    if (isPostgres()) await getPrisma().feedback.delete({ where: { id: mine.id } });
    else memory.feedback.remove(mine.id);
    res.json({ ok: true });
  }),
};

export const userController = {
  preferences: asyncHandler(async (req, res) => {
    const preferences = await getUserPreferences(req.user.id);
    res.json({ preferences });
  }),

  updatePreferences: asyncHandler(async (req, res) => {
    const preferences = await setUserPreferences(req.user.id, req.body);
    res.json({ preferences });
  }),

  usage: asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);
    const usage = await usageRepo.userUsage(req.user.id, { days });
    res.json({ usage, windowDays: days });
  }),

  stats: asyncHandler(async (req, res) => {
    const { conversationRepo } = await import('../repositories/conversationRepo.js');
    const { documentRepo } = await import('../repositories/documentRepo.js');
    const [conversations, documents, usage] = await Promise.all([
      conversationRepo.countByUser(req.user.id),
      documentRepo.listByUser(req.user.id, { limit: 1 }),
      usageRepo.userUsage(req.user.id, { days: 30 }),
    ]);
    res.json({ conversations, documents: documents.total, usage });
  }),
};

export default { feedbackController, userController };
