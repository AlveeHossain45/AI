/**
 * Conversation + message repository.
 */
import { getPrisma, isPostgres, memory } from '../db/index.js';

const messageInclude = undefined;

export const conversationRepo = {
  listByUser: async (userId, { search = '', includeArchived = false, limit = 50, offset = 0, folderId } = {}) => {
    if (isPostgres()) {
      const where = {
        userId,
        ...(includeArchived ? {} : { archived: false }),
        ...(folderId ? { folderId } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { messages: { some: { content: { contains: search, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      };
      const [rows, total] = await Promise.all([
        getPrisma().conversation.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          take: limit,
          skip: offset,
          include: { _count: { select: { messages: true } }, folder: true },
        }),
        getPrisma().conversation.count({ where }),
      ]);
      return { rows, total };
    }
    let rows = memory.conversations.filter((row) => row.userId === userId && (includeArchived || !row.archived));
    if (folderId) rows = rows.filter((row) => row.folderId === folderId);
    if (search) {
      const needle = search.toLowerCase();
      rows = rows.filter(
        (row) =>
          row.title.toLowerCase().includes(needle) ||
          memory.messages
            .filter((m) => m.conversationId === row.id)
            .some((m) => m.content.toLowerCase().includes(needle))
      );
    }
    rows.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const total = rows.length;
    rows = rows.slice(offset, offset + limit).map((row) => ({
      ...row,
      _count: { messages: memory.messages.count((m) => m.conversationId === row.id) },
      folder: row.folderId ? memory.folders.get(row.folderId) : null,
    }));
    return { rows, total };
  },

  findById: async (id, userId) => {
    if (isPostgres()) {
      return getPrisma().conversation.findFirst({ where: { id, ...(userId ? { userId } : {}) } });
    }
    const row = memory.conversations.get(id);
    if (!row) return null;
    if (userId && row.userId !== userId) return null;
    return row;
  },

  create: async (data) => {
    if (isPostgres()) return getPrisma().conversation.create({ data });
    return memory.conversations.insert({ title: 'New chat', archived: false, ...data });
  },

  update: async (id, patch) => {
    if (isPostgres()) return getPrisma().conversation.update({ where: { id }, data: patch });
    return memory.conversations.update(id, patch);
  },

  remove: async (id, userId) => {
    if (isPostgres()) {
      const count = await getPrisma().conversation.deleteMany({ where: { id, userId } });
      return count.count > 0;
    }
    const row = memory.conversations.get(id);
    if (!row || row.userId !== userId) return false;
    memory.messages.removeWhere((m) => m.conversationId === id);
    memory.conversations.remove(id);
    return true;
  },

  countByUser: async (userId) => {
    if (isPostgres()) return getPrisma().conversation.count({ where: { userId } });
    return memory.conversations.count((row) => row.userId === userId);
  },
};

export const messageRepo = {
  listByConversation: async (conversationId, { limit = 200, after } = {}) => {
    if (isPostgres()) {
      return getPrisma().message.findMany({
        where: { conversationId, ...(after ? { createdAt: { gt: new Date(after) } } : {}) },
        orderBy: { createdAt: 'asc' },
        take: limit,
        include: { feedback: true },
      });
    }
    let rows = memory.messages.filter((row) => row.conversationId === conversationId);
    if (after) rows = rows.filter((row) => new Date(row.createdAt) > new Date(after));
    rows.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return rows.slice(0, limit).map((row) => ({
      ...row,
      feedback: memory.feedback.filter((f) => f.messageId === row.id),
    }));
  },

  findById: async (id) => {
    if (isPostgres()) return getPrisma().message.findUnique({ where: { id }, include: { feedback: true } });
    const row = memory.messages.get(id);
    if (!row) return null;
    return { ...row, feedback: memory.feedback.filter((f) => f.messageId === row.id) };
  },

  create: async (data) => {
    if (isPostgres()) return getPrisma().message.create({ data, include: { feedback: true } });
    const row = memory.messages.insert(data);
    return { ...row, feedback: [] };
  },

  update: async (id, patch) => {
    if (isPostgres()) return getPrisma().message.update({ where: { id }, data: patch, include: { feedback: true } });
    const row = memory.messages.update(id, patch);
    return row ? { ...row, feedback: [] } : null;
  },

  countByConversation: async (conversationId) => {
    if (isPostgres()) return getPrisma().message.count({ where: { conversationId } });
    return memory.messages.count((row) => row.conversationId === conversationId);
  },

  _messageInclude: messageInclude,
};

export const folderRepo = {
  listByUser: async (userId) => {
    if (isPostgres()) {
      return getPrisma().folder.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, include: { _count: { select: { conversations: true } } } });
    }
    return memory.folders
      .filter((row) => row.userId === userId)
      .map((row) => ({ ...row, _count: { conversations: memory.conversations.count((c) => c.folderId === row.id) } }));
  },

  create: async (userId, data) => {
    if (isPostgres()) return getPrisma().folder.create({ data: { userId, ...data } });
    return memory.folders.insert({ userId, ...data });
  },

  update: async (id, userId, patch) => {
    if (isPostgres()) return getPrisma().folder.updateMany({ where: { id, userId }, data: patch });
    const row = memory.folders.get(id);
    if (!row || row.userId !== userId) return { count: 0 };
    memory.folders.update(id, patch);
    return { count: 1 };
  },

  remove: async (id, userId) => {
    if (isPostgres()) {
      const res = await getPrisma().folder.deleteMany({ where: { id, userId } });
      return res.count > 0;
    }
    const row = memory.folders.get(id);
    if (!row || row.userId !== userId) return false;
    memory.conversations.filter((c) => c.folderId === id).forEach((c) => memory.conversations.update(c.id, { folderId: null }));
    memory.folders.remove(id);
    return true;
  },
};

export default conversationRepo;
