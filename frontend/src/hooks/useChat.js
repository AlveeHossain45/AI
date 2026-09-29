import { useCallback, useEffect, useRef, useState } from 'react';
import { api, streamRequest } from '../api/client.js';

/**
 * Chat state machine: conversation loading, optimistic messaging,
 * SSE streaming, stop/regenerate/edit, sources & status events.
 */
export function useChat (conversationId, { onNavigate } = {}) {
  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(Boolean(conversationId));
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState(null);
  const [meta, setMeta] = useState(null);
  const [sources, setSources] = useState([]);
  const [verification, setVerification] = useState(null);
  const [error, setError] = useState(null);
  const [activeRequestId, setActiveRequestId] = useState(0);

  const abortRef = useRef(null);
  const requestRef = useRef(null);

  const loadConversation = useCallback(async (id) => {
    setError(null);
    setSources([]);
    setMeta(null);
    setVerification(null);
    setStatus(null);
    if (!id) {
      setConversation(null);
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.get(`/api/conversations/${id}`);
      setConversation(data.conversation);
      setMessages(data.messages.map(normalizeMessage));
    } catch (err) {
      setError(err.message);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // While streaming, a route change (new-chat navigation) must not wipe
    // optimistic/partial message state — reload once the stream settles.
    if (streaming) return;
    loadConversation(conversationId);
  }, [conversationId, loadConversation, streaming]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    setStatus(null);
  }, []);

  const send = useCallback(async ({ content, mode = 'AUTO', documentIds = [], fileIds = [], replaceFrom = null }) => {
    const text = String(content || '').trim();
    if (!text || abortRef.current) return null;

    setError(null);
    setStreaming(true);
    setStatus({ stage: 'prepare', detail: 'Preparing request' });
    setSources([]);
    setVerification(null);
    setMeta(null);

    // Optimistic user turn (+ placeholder assistant turn).
    const tempUserId = `temp-user-${Date.now()}`;
    const tempAssistantId = `temp-assistant-${Date.now()}`;
    setMessages((current) => {
      const base = replaceFrom !== null ? current.slice(0, replaceFrom) : current;
      return [
        ...base,
        { id: tempUserId, role: 'user', content: text, metadata: { mode, documentIds, images: fileIds.length }, createdAt: new Date().toISOString(), pending: true },
        { id: tempAssistantId, role: 'assistant', content: '', metadata: {}, createdAt: new Date().toISOString(), streaming: true },
      ];
    });

    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = Date.now();
    requestRef.current = requestId;
    setActiveRequestId(requestId);

    let assistantContent = '';
    let localConversationId = conversationId;
    let localMeta = null;

    const { promise } = streamRequest(
      '/api/chat/stream',
      { conversationId: conversationId || undefined, message: text, mode, documentIds, fileIds },
      {
        signal: controller.signal,
        onEvent: (type, data) => {
          switch (type) {
            case 'meta': {
              localMeta = data;
              setMeta(data);
              if (data.conversationId && !conversationId) {
                localConversationId = data.conversationId;
                onNavigate?.(`/chat/${data.conversationId}`, { replace: true });
                setConversation((c) => c || { id: data.conversationId, title: data.title || 'New chat' });
              }
              setMessages((current) => current.map((m) => (m.id === tempUserId ? { ...m, id: data.userMessageId || m.id, pending: false } : m)));
              break;
            }
            case 'status':
              setStatus(data);
              break;
            case 'sources':
              setSources(data.sources || []);
              break;
            case 'delta': {
              assistantContent += data.text || '';
              setMessages((current) => current.map((m) => (m.id === tempAssistantId ? { ...m, content: assistantContent } : m)));
              break;
            }
            case 'verification':
              setVerification(data);
              break;
            case 'done': {
              assistantContent = data.content ?? assistantContent;
              setMessages((current) => current.map((m) => {
                if (m.id !== tempAssistantId) return m;
                return {
                  ...m,
                  id: data.assistantMessageId || m.id,
                  content: assistantContent,
                  streaming: false,
                  metadata: {
                    model: data.model,
                    provider: data.provider,
                    mode: data.mode,
                    demo: data.demo,
                    grounded: data.grounded,
                    verification: data.verification,
                    sources: data.sourcesCount,
                    stopped: data.stopped,
                    latencyMs: data.latencyMs,
                  },
                };
              }));
              if (data.title && localConversationId) {
                setConversation((c) => (c ? { ...c, title: data.title } : c));
              }
              break;
            }
            case 'error': {
              setError(data.message || 'Something went wrong. Please try again.');
              setMessages((current) => current.map((m) => (m.id === tempAssistantId ? { ...m, streaming: false, error: true } : m)));
              break;
            }
            default:
              break;
          }
        },
      }
    );

    try {
      await promise;
      // If the stream aborted mid-way, keep whatever text arrived.
      setMessages((current) => current.map((m) => (m.id === tempAssistantId && m.streaming ? { ...m, streaming: false, content: assistantContent } : m)));
      if (!localMeta && !assistantContent) {
        setError((prev) => prev || 'The connection was interrupted. Please try again.');
      }
      return { conversationId: localConversationId };
    } catch (err) {
      if (err?.name === 'AbortError') {
        setMessages((current) => current.map((m) => (m.id === tempAssistantId
          ? { ...m, streaming: false, content: assistantContent || '*Generation stopped.*', metadata: { ...m.metadata, stopped: true } }
          : m)));
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
        setMessages((current) => current.filter((m) => m.id !== tempAssistantId || m.content));
      }
      return null;
    } finally {
      abortRef.current = null;
      requestRef.current = null;
      setStreaming(false);
      setStatus(null);
    }
  }, [conversationId, onNavigate]);

  /** Re-send the last user message (optionally edited). */
  const regenerate = useCallback((editedContent = null) => {
    const lastUserIndex = [...messages].reverse().findIndex((m) => m.role === 'user');
    if (lastUserIndex === -1) return;
    const index = messages.length - 1 - lastUserIndex;
    const target = messages[index];
    const content = editedContent ?? target.content;
    const metadata = target.metadata || {};
    return send({
      content,
      mode: metadata.mode || 'AUTO',
      documentIds: metadata.documentIds || [],
      fileIds: [],
      replaceFrom: index,
    });
  }, [messages, send]);

  const setMessageFeedback = useCallback((messageId, feedback) => {
    setMessages((current) => current.map((m) => (m.id === messageId ? { ...m, feedback } : m)));
  }, []);

  const patchConversation = useCallback((patch) => {
    setConversation((current) => (current ? { ...current, ...patch } : current));
  }, []);

  return {
    messages,
    conversation,
    loading,
    streaming,
    status,
    meta,
    sources,
    verification,
    error,
    activeRequestId,
    send,
    stop,
    regenerate,
    reload: () => loadConversation(conversationId),
    setMessageFeedback,
    patchConversation,
    setError,
    setMessages,
  };
}

const normalizeMessage = (row) => ({
  ...row,
  role: typeof row.role === 'string' ? row.role.toLowerCase() : row.role,
  metadata: row.metadata || {},
});

export default useChat;
