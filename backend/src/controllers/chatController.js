/**
 * Chat controller: streaming (SSE) and non-streaming chat endpoints.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import config from '../config/index.js';
import { asyncHandler } from '../utils/crypto.js';
import { notFound, badRequest, serviceUnavailable } from '../utils/errors.js';
import { initSse, sendEvent, endSse } from '../utils/sse.js';
import { runChatPipeline } from '../services/ai/chatPipeline.js';
import conversationRepo from '../repositories/conversationRepo.js';
import documentRepo from '../repositories/documentRepo.js';
import { getAiProvider } from '../providers/ai/index.js';
import logger from '../utils/logger.js';

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

async function resolveConversation (user, conversationId) {
  if (!conversationId) return conversationRepo.create({ userId: user.id, title: 'New chat' });
  const conversation = await conversationRepo.findById(conversationId, user.id);
  if (!conversation) throw notFound('Conversation not found.');
  return conversation;
}

/** Load uploaded images (by fileId) as base64 for multimodal requests. */
async function loadImages (userId, fileIds = []) {
  if (!fileIds.length) return [];
  const images = [];
  for (const fileId of fileIds.slice(0, 5)) {
    // eslint-disable-next-line no-await-in-loop
    const document = await documentRepo.findById(fileId, userId);
    if (!document) throw notFound('One of the attached files no longer exists.');
    if (!document.mimeType.startsWith('image/')) continue;
    // eslint-disable-next-line no-await-in-loop
    const buffer = await fs.readFile(path.join(config.storage.root, document.storagePath)).catch(() => null);
    if (!buffer) throw notFound('One of the attached files could not be read.');
    if (buffer.length > MAX_IMAGE_BYTES) throw badRequest(`Image "${document.filename}" is too large (max 6 MB for vision input).`);
    images.push({
      filename: document.filename,
      mimeType: document.mimeType,
      base64: buffer.toString('base64'),
    });
  }
  return images;
}

export const chatController = {
  /** POST /api/chat/stream — SSE stream of the answer. */
  stream: asyncHandler(async (req, res) => {
    const { conversationId, message, mode, documentIds, fileIds } = req.body;
    const conversation = await resolveConversation(req.user, conversationId);
    const imageData = await loadImages(req.user.id, fileIds);

    const abort = new AbortController();
    const onClose = () => abort.abort();
    req.on('close', onClose);

    initSse(res);
    sendEvent(res, 'open', { conversationId: conversation.id });

    try {
      await runChatPipeline({
        user: req.user,
        conversation,
        question: message,
        mode,
        documentIds,
        imageData,
        signal: abort.signal,
        emit: (type, data) => sendEvent(res, type, data),
      });
    } catch (error) {
      logger.error(`Chat stream failed: ${error.message}`);
      sendEvent(res, 'error', {
        code: error.code || 'AI_ERROR',
        message: error.message || 'Something went wrong. Please try again.',
      });
    } finally {
      req.off('close', onClose);
      endSse(res);
    }
  }),

  /** POST /api/chat — non-streaming JSON response (same pipeline). */
  create: asyncHandler(async (req, res) => {
    const { conversationId, message, mode, documentIds, fileIds } = req.body;
    const conversation = await resolveConversation(req.user, conversationId);
    const imageData = await loadImages(req.user.id, fileIds);
    const abort = new AbortController();

    let done = null;
    let error = null;
    await runChatPipeline({
      user: req.user,
      conversation,
      question: message,
      mode,
      documentIds,
      imageData,
      signal: abort.signal,
      emit: (type, data) => {
        if (type === 'done') done = data;
        if (type === 'error') error = data;
      },
    });

    if (error && !done) throw serviceUnavailable(error.message);
    res.json({
      conversationId: conversation.id,
      answer: done?.content || '',
      messageId: done?.assistantMessageId,
      sources: done?.sources ?? 0,
      model: done?.model,
      provider: done?.provider,
      mode: done?.mode || mode,
      latencyMs: done?.latencyMs,
      demo: Boolean(done?.demo),
      verification: done?.verification || null,
      error: error || null,
    });
  }),

  /** GET /api/chat/providers — which AI providers are configured (no secrets). */
  providers: asyncHandler(async (req, res) => {
    void req;
    try {
      const provider = getAiProvider();
      res.json({ provider: provider.name, label: provider.label, demo: provider.name === 'mock' });
    } catch {
      res.json({ provider: null, label: null, demo: false, configured: false });
    }
  }),
};

export default chatController;
