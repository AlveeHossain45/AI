/**
 * Admin controller: analytics, user management, global settings, system status.
 */
import { asyncHandler } from '../utils/crypto.js';
import { notFound, badRequest } from '../utils/errors.js';
import { userRepo } from '../repositories/userRepo.js';
import { usageRepo } from '../repositories/usageRepo.js';
import { searchRepo } from '../repositories/searchRepo.js';
import { feedbackRepo } from '../repositories/settingRepo.js';
import conversationRepo from '../repositories/conversationRepo.js';
import documentRepo from '../repositories/documentRepo.js';
import { getGlobalSettings, updateGlobalSettings } from '../services/settingsService.js';
import { availableAiProviders, getAiProvider, resetAiProvider } from '../providers/ai/index.js';
import { availableSearchProviders } from '../providers/search/index.js';
import { embeddingInfo } from '../providers/embeddings/index.js';
import { vectorStoreInfo } from '../providers/vector/index.js';
import { dbMode, isPostgres, getPrisma, memory } from '../db/index.js';
import { listConnectors } from '../providers/knowledge/index.js';
import config from '../config/index.js';

export const adminController = {
  /** GET /api/admin/analytics */
  analytics: asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const [usage, totalUsers, searchQueries, searchResults, feedback, settings, documents, activeUsers] = await Promise.all([
      usageRepo.summary({ days }),
      userRepo.count(),
      searchRepo.countQueries(),
      searchRepo.countResults(),
      feedbackRepo.stats({ days }),
      getGlobalSettings(),
      countDocuments(),
      countActiveUsers(),
    ]);

    const [conversations, messages] = await Promise.all([countConversations(), countMessages()]);

    res.json({
      windowDays: days,
      users: { total: totalUsers, active: activeUsers },
      conversations,
      messages,
      documents,
      ai: usage,
      search: { queries: searchQueries, results: searchResults },
      feedback,
      settings,
    });
  }),

  /** GET /api/admin/users */
  users: asyncHandler(async (req, res) => {
    const { rows, total } = await userRepo.list({
      skip: Number(req.query.offset) || 0,
      take: Math.min(Number(req.query.limit) || 20, 100),
      search: req.query.search || '',
    });
    const users = await Promise.all(
      rows.map(async (user) => {
        const usage = await usageRepo.userUsage(user.id, { days: 30 }).catch(() => ({ requests: 0, tokens: 0 }));
        return { ...user, usage30d: usage };
      })
    );
    res.json({ users, total });
  }),

  /** PATCH /api/admin/users/:id */
  updateUser: asyncHandler(async (req, res) => {
    const target = await userRepo.findById(req.params.id);
    if (!target) throw notFound('User not found.');
    if (req.user.id === target.id && req.body.role === 'USER') {
      throw badRequest('You cannot remove your own admin role.');
    }
    const patch = {};
    if (req.body.role) patch.role = req.body.role;
    if (req.body.isSuspended !== undefined) patch.isSuspended = req.body.isSuspended;
    if (req.body.name) patch.name = req.body.name;
    const updated = await userRepo.update(target.id, patch);
    const { passwordHash, ...safe } = updated;
    void passwordHash;
    res.json({ user: safe });
  }),

  /** GET /api/admin/settings */
  getSettings: asyncHandler(async (req, res) => {
    const settings = await getGlobalSettings();
    res.json({ settings });
  }),

  /** PATCH /api/admin/settings */
  updateSettings: asyncHandler(async (req, res) => {
    const settings = await updateGlobalSettings(req.body);
    res.json({ settings });
  }),

  /** GET /api/admin/system — configuration status without exposing secrets. */
  system: asyncHandler(async (req, res) => {
    void req;
    let ai = { provider: null, label: null, demo: false, configured: false };
    try {
      const provider = getAiProvider();
      ai = { provider: provider.name, label: provider.label, demo: provider.name === 'mock', configured: true };
    } catch { /* not configured */ }

    res.json({
      env: config.env,
      database: { mode: dbMode(), configured: Boolean(config.db.url) },
      vector: { provider: vectorStoreInfo() },
      ai,
      aiProviders: availableAiProviders(),
      search: {
        configured: config.search.provider,
        available: availableSearchProviders(),
        fallback: config.search.fallback,
      },
      embedding: embeddingInfo(),
      knowledgeConnectors: listConnectors(),
      limits: {
        maxFileMb: config.limits.maxFileMb,
        chatRateLimit: config.limits.chatMax,
        contextMaxTokens: config.limits.contextMaxTokens,
        research: config.research,
      },
      features: config.features,
    });
  }),

  /** POST /api/admin/system/reload-providers — re-resolve provider singletons. */
  reloadProviders: asyncHandler(async (req, res) => {
    void req;
    resetAiProvider();
    const provider = getAiProvider();
    res.json({ ok: true, ai: provider.name });
  }),
};

const countActiveUsers = async () => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (isPostgres()) return getPrisma().user.count({ where: { lastLoginAt: { gte: since } } });
  return memory.users.filter((row) => row.lastLoginAt && new Date(row.lastLoginAt) >= since).length;
};

const countConversations = () => (isPostgres() ? getPrisma().conversation.count() : memory.conversations.count());
const countMessages = () => (isPostgres() ? getPrisma().message.count() : memory.messages.count());
const countDocuments = () => (isPostgres() ? getPrisma().document.count() : memory.documents.count());

export default adminController;
