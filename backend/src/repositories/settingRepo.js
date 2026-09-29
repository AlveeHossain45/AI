/**
 * Feedback, settings and verification-token repositories.
 */
import { getPrisma, isPostgres, memory } from '../db/index.js';

export const feedbackRepo = {
  upsert: async ({ userId, messageId, rating, comment }) => {
    if (isPostgres()) {
      const prisma = getPrisma();
      return prisma.feedback.upsert({
        where: { messageId_userId: { messageId, userId } },
        create: { userId, messageId, rating, comment: comment || null },
        update: { rating, comment: comment || null },
      });
    }
    const existing = memory.feedback.find((row) => row.messageId === messageId && row.userId === userId);
    if (existing) return memory.feedback.update(existing.id, { rating, comment: comment || null });
    return memory.feedback.insert({ userId, messageId, rating, comment: comment || null });
  },

  forMessage: async (messageId) => {
    if (isPostgres()) return getPrisma().feedback.findMany({ where: { messageId } });
    return memory.feedback.filter((row) => row.messageId === messageId);
  },

  stats: async ({ days = 30 } = {}) => {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    if (isPostgres()) {
      const rows = await getPrisma().feedback.groupBy({ by: ['rating'], where: { createdAt: { gte: since } }, _count: { id: true } });
      return rows.map((row) => ({ rating: row.rating, count: row._count.id }));
    }
    const map = new Map();
    for (const row of memory.feedback.filter((r) => new Date(r.createdAt) >= since)) {
      map.set(row.rating, (map.get(row.rating) || 0) + 1);
    }
    return [...map.entries()].map(([rating, count]) => ({ rating, count }));
  },
};

export const settingRepo = {
  getGlobal: async (key, fallback = null) => {
    if (isPostgres()) {
      const row = await getPrisma().setting.findFirst({ where: { key, scope: 'GLOBAL', userId: null } });
      return row ? row.value : fallback;
    }
    const row = memory.settings.find((r) => r.key === key && r.scope === 'GLOBAL' && !r.userId);
    return row ? row.value : fallback;
  },

  getUser: async (userId, key, fallback = null) => {
    if (isPostgres()) {
      const row = await getPrisma().setting.findFirst({ where: { key, scope: 'USER', userId } });
      return row ? row.value : fallback;
    }
    const row = memory.settings.find((r) => r.key === key && r.userId === userId);
    return row ? row.value : fallback;
  },

  setGlobal: async (key, value) => {
    if (isPostgres()) {
      const prisma = getPrisma();
      return prisma.setting.upsert({
        where: { key_userId_scope: { key, userId: null, scope: 'GLOBAL' } },
        create: { key, scope: 'GLOBAL', userId: null, value },
        update: { value },
      });
    }
    const existing = memory.settings.find((r) => r.key === key && r.scope === 'GLOBAL' && !r.userId);
    if (existing) return memory.settings.update(existing.id, { value });
    return memory.settings.insert({ key, scope: 'GLOBAL', userId: null, value });
  },

  setUser: async (userId, key, value) => {
    if (isPostgres()) {
      const prisma = getPrisma();
      return prisma.setting.upsert({
        where: { key_userId_scope: { key, userId, scope: 'USER' } },
        create: { key, scope: 'USER', userId, value },
        update: { value },
      });
    }
    const existing = memory.settings.find((r) => r.key === key && r.userId === userId);
    if (existing) return memory.settings.update(existing.id, { value });
    return memory.settings.insert({ key, scope: 'USER', userId, value });
  },

  allGlobals: async () => {
    if (isPostgres()) {
      const rows = await getPrisma().setting.findMany({ where: { scope: 'GLOBAL', userId: null } });
      return Object.fromEntries(rows.map((row) => [row.key, row.value]));
    }
    const rows = memory.settings.filter((r) => r.scope === 'GLOBAL' && !r.userId);
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  },
};

export const tokenRepo = {
  create: async ({ userId, purpose, tokenHash, expiresAt }) => {
    if (isPostgres()) return getPrisma().verificationToken.create({ data: { userId, purpose, tokenHash, expiresAt } });
    return memory.verificationTokens.insert({ userId, purpose, tokenHash, expiresAt, usedAt: null });
  },

  findValid: async (tokenHash, purpose) => {
    const now = new Date();
    if (isPostgres()) {
      return getPrisma().verificationToken.findFirst({
        where: { tokenHash, purpose, usedAt: null, expiresAt: { gt: now } },
        include: { user: true },
      });
    }
    const row = memory.verificationTokens.find(
      (r) => r.tokenHash === tokenHash && r.purpose === purpose && !r.usedAt && new Date(r.expiresAt) > now
    );
    return row ? { ...row, user: memory.users.get(row.userId) } : null;
  },

  markUsed: async (id) => {
    if (isPostgres()) return getPrisma().verificationToken.update({ where: { id }, data: { usedAt: new Date() } });
    return memory.verificationTokens.update(id, { usedAt: new Date() });
  },

  invalidateFor: async (userId, purpose) => {
    if (isPostgres()) {
      await getPrisma().verificationToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: new Date() } });
      return true;
    }
    memory.verificationTokens
      .filter((r) => r.userId === userId && r.purpose === purpose && !r.usedAt)
      .forEach((r) => memory.verificationTokens.update(r.id, { usedAt: new Date() }));
    return true;
  },
};

export default { feedbackRepo, settingRepo, tokenRepo };
