/**
 * Conversation controller: CRUD, messages, folders, export, search.
 */
import { asyncHandler } from '../utils/crypto.js';
import { notFound, badRequest } from '../utils/errors.js';
import conversationRepo, { messageRepo, folderRepo } from '../repositories/conversationRepo.js';

const serializeConversation = (row) => ({
  id: row.id,
  title: row.title,
  folderId: row.folderId || null,
  folder: row.folder ? { id: row.folder.id, name: row.folder.name, color: row.folder.color } : null,
  archived: Boolean(row.archived),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  messageCount: row._count?.messages ?? row.messageCount ?? 0,
});

const serializeMessage = (row) => ({
  id: row.id,
  role: row.role.toLowerCase(),
  content: row.content,
  metadata: row.metadata || {},
  createdAt: row.createdAt,
  feedback: row.feedback?.[0] ? { rating: row.feedback[0].rating } : null,
});

export const conversationController = {
  list: asyncHandler(async (req, res) => {
    const { search, limit, offset, folderId, includeArchived } = req.query;
    const { rows, total } = await conversationRepo.listByUser(req.user.id, {
      search: search || '',
      limit,
      offset,
      folderId,
      includeArchived: Boolean(includeArchived),
    });
    res.json({ conversations: rows.map(serializeConversation), total, limit, offset });
  }),

  create: asyncHandler(async (req, res) => {
    const conversation = await conversationRepo.create({
      userId: req.user.id,
      title: req.body.title || 'New chat',
    });
    res.status(201).json({ conversation: serializeConversation(conversation) });
  }),

  get: asyncHandler(async (req, res) => {
    const conversation = await conversationRepo.findById(req.params.id, req.user.id);
    if (!conversation) throw notFound('Conversation not found.');
    const messages = await messageRepo.listByConversation(conversation.id);
    res.json({
      conversation: serializeConversation({ ...conversation, _count: { messages: messages.length } }),
      messages: messages.map(serializeMessage),
    });
  }),

  update: asyncHandler(async (req, res) => {
    const existing = await conversationRepo.findById(req.params.id, req.user.id);
    if (!existing) throw notFound('Conversation not found.');
    const patch = {};
    if (req.body.title !== undefined) patch.title = req.body.title;
    if (req.body.folderId !== undefined) patch.folderId = req.body.folderId;
    if (req.body.archived !== undefined) patch.archived = req.body.archived;
    if (req.body.summary !== undefined) patch.summary = req.body.summary;
    const updated = await conversationRepo.update(existing.id, patch);
    res.json({ conversation: serializeConversation(updated) });
  }),

  remove: asyncHandler(async (req, res) => {
    const removed = await conversationRepo.remove(req.params.id, req.user.id);
    if (!removed) throw notFound('Conversation not found.');
    res.json({ ok: true });
  }),

  messages: asyncHandler(async (req, res) => {
    const conversation = await conversationRepo.findById(req.params.id, req.user.id);
    if (!conversation) throw notFound('Conversation not found.');
    const messages = await messageRepo.listByConversation(conversation.id, {
      limit: Math.min(Number(req.query.limit) || 200, 500),
    });
    res.json({ messages: messages.map(serializeMessage) });
  }),

  /** Export a conversation as Markdown, plain text or JSON. */
  export: asyncHandler(async (req, res) => {
    const conversation = await conversationRepo.findById(req.params.id, req.user.id);
    if (!conversation) throw notFound('Conversation not found.');
    const messages = await messageRepo.listByConversation(conversation.id);
    const format = req.query.format || 'md';

    if (format === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="novaai-${conversation.id}.json"`);
      return res.json({
        title: conversation.title,
        exportedAt: new Date().toISOString(),
        messages: messages.map((row) => ({ role: row.role.toLowerCase(), content: row.content, createdAt: row.createdAt })),
      });
    }

    const lines = messages.map((row) => {
      const who = row.role === 'USER' ? 'You' : 'NovaAI';
      return format === 'md' ? `### ${who}\n\n${row.content}\n` : `${who}:\n${row.content}\n\n`;
    });
    const header = format === 'md' ? `# ${conversation.title}\n\n` : `${conversation.title}\n${'='.repeat(conversation.title.length)}\n\n`;
    const body = header + lines.join('\n');
    const ext = format === 'md' ? 'md' : 'txt';
    res.setHeader('Content-Type', format === 'md' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="novaai-chat.${ext}"`);
    return res.send(body);
  }),

  folders: {
    list: asyncHandler(async (req, res) => {
      const folders = await folderRepo.listByUser(req.user.id);
      res.json({ folders });
    }),
    create: asyncHandler(async (req, res) => {
      const folder = await folderRepo.create(req.user.id, { name: req.body.name, color: req.body.color || null });
      res.status(201).json({ folder });
    }),
    update: asyncHandler(async (req, res) => {
      const result = await folderRepo.update(req.params.id, req.user.id, {
        ...(req.body.name ? { name: req.body.name } : {}),
        ...(req.body.color !== undefined ? { color: req.body.color } : {}),
      });
      if (!result || (result.count !== undefined && result.count === 0)) throw notFound('Folder not found.');
      res.json({ ok: true });
    }),
    remove: asyncHandler(async (req, res) => {
      const removed = await folderRepo.remove(req.params.id, req.user.id);
      if (!removed) throw notFound('Folder not found.');
      res.json({ ok: true });
    }),
  },

  assertOwner: (conversation, userId) => {
    if (!conversation || conversation.userId !== userId) throw notFound('Conversation not found.');
    if (!userId) throw badRequest();
    return conversation;
  },
};

export default conversationController;
