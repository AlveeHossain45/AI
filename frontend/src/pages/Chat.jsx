import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { PanelRightOpen, PanelRightClose, Menu, AlertCircle, X } from 'lucide-react';
import { useChat } from '../hooks/useChat.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import MessageBubble from '../components/chat/MessageBubble.jsx';
import ChatInput from '../components/chat/ChatInput.jsx';
import Welcome from '../components/chat/Welcome.jsx';
import SourcesPanel from '../components/chat/SourcesPanel.jsx';
import StatusIndicator from '../components/chat/StatusIndicator.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { api } from '../api/client.js';
import { speak, textToSpeechSupported } from '../services/speech.js';

export default function Chat () {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { openSidebar } = useOutletContext();
  const { user, preferences, updatePreferences } = useAuth();
  const { push } = useToast();

  const [mode, setMode] = useState(preferences.mode || 'AUTO');
  const [showSources, setShowSources] = useState(preferences.showSources !== false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [providerInfo, setProviderInfo] = useState(null);
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);
  const lastErrorRef = useRef(null);
  const spokenRef = useRef(new Set());

  const chat = useChat(conversationId, { onNavigate: (path, opts) => navigate(path, opts) });
  const { messages, loading, streaming, status, meta, sources, error, verification } = chat;

  // Scroll to bottom on new content when user is near the bottom.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 260;
    if (nearBottom || streaming) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, streaming, status]);

  // Surface stream errors as toasts (once per error).
  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      lastErrorRef.current = error;
      push(error, 'error');
    }
    if (!error) lastErrorRef.current = null;
  }, [error, push]);

  // Which providers this deployment runs (drives the demo-mode notice).
  useEffect(() => {
    api.get('/api/chat/providers').then(setProviderInfo).catch(() => setProviderInfo(null));
  }, []);

  // Optional auto read-aloud of newly completed answers.
  useEffect(() => {
    if (streaming || !preferences.speakAnswers || !textToSpeechSupported()) return;
    const last = [...messages].reverse().find((item) => item.role === 'assistant' && !item.streaming && item.content);
    if (!last || spokenRef.current.has(last.id)) return;
    spokenRef.current.add(last.id);
    speak(last.content);
  }, [messages, streaming, preferences.speakAnswers]);

  useEffect(() => {
    const handler = () => window.dispatchEvent(new Event('novaai:focus-search'));
    const keyHandler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') event.preventDefault();
    };
    window.addEventListener('keydown', keyHandler);
    return () => {
      window.removeEventListener('keydown', keyHandler);
      void handler;
    };
  }, []);

  const handleSend = useCallback(async ({ content, mode: sendMode, fileIds, documentIds }) => {
    const result = await chat.send({ content, mode: sendMode, fileIds, documentIds });
    if (sendMode !== mode) {
      setMode(sendMode);
      updatePreferences({ mode: sendMode }).catch(() => {});
    }
    void result;
  }, [chat, mode, updatePreferences]);

  const handleRegenerate = useCallback((editedContent) => {
    chat.regenerate(editedContent);
  }, [chat]);

  const toggleSources = () => {
    const next = !showSources;
    setShowSources(next);
    updatePreferences({ showSources: next }).catch(() => {});
  };

  const activeMeta = useMemo(() => meta, [meta]);

  return (
    <div className="flex h-full min-h-0 flex-1">
      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200/80 bg-white/70 px-3 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]">
          <button
            type="button"
            onClick={openSidebar}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10 lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-slate-800 dark:text-white">
              {chat.conversation?.title || 'New chat'}
            </h1>
            {chat.conversation ? (
              <p className="truncate text-[11px] text-slate-400">
                {messages.length ? `${messages.length} messages` : 'Empty conversation'} · mode {mode}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={toggleSources}
            className={`hidden rounded-xl px-3 py-1.5 text-xs font-semibold transition sm:inline-flex ${
              showSources
                ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300'
                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
            }`}
            aria-pressed={showSources}
            title="Show or hide the sources panel"
          >
            Sources
          </button>

          <button
            type="button"
            onClick={() => setPanelOpen((value) => !value)}
            className="hidden rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-white/10 xl:inline-flex"
            aria-label={panelOpen ? 'Close details panel' : 'Open details panel'}
            title="Context panel"
          >
            {panelOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
          </button>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner size="lg" label="Loading conversation" />
            </div>
          ) : messages.length === 0 ? (
            <Welcome
              onSelect={(prompt) => handleSend({ content: prompt, mode, fileIds: [], documentIds: [] })}
              userName={user?.name?.split(' ')[0]}
              demo={Boolean(providerInfo?.demo)}
              grounded={providerInfo?.provider === 'grounded'}
              mode={mode}
            />
          ) : (
            <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
              <AnimatePresence>{status ? <StatusIndicator status={status} /> : null}</AnimatePresence>

              {messages.map((message, index) => {
                const isLastAssistant = message.role === 'assistant'
                  && index === messages.length - 1;
                const messageSources = isLastAssistant && sources.length
                  ? sources
                  : (message.metadata?.sources || []);
                return (
                  <div key={message.id}>
                    <MessageBubble
                      message={message}
                      sources={messageSources}
                      streaming={Boolean(message.streaming)}
                      onRegenerate={message.role === 'assistant' ? handleRegenerate : null}
                      onFeedback={chat.setMessageFeedback}
                    />
                    {message.role === 'assistant' && !message.streaming && showSources && isLastAssistant ? (
                      <div className="pl-0 sm:pl-9">
                        <SourcesPanel
                          sources={messageSources}
                          meta={isLastAssistant ? activeMeta : null}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {streaming && status && !messages.some((m) => m.streaming) ? (
                <StatusIndicator status={status} />
              ) : null}

              <div ref={bottomRef} className="h-2" />
            </div>
          )}
        </div>

        <div className="shrink-0 px-3 pb-3 sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <ChatInput
              onSend={handleSend}
              onStop={chat.stop}
              streaming={streaming}
              mode={mode}
              onModeChange={(next) => { setMode(next); updatePreferences({ mode: next }).catch(() => {}); }}
              enterToSend={preferences.enterToSend !== false}
              autoFocus
            />
          </div>
        </div>
      </div>

      {/* Right context panel (xl+) */}
      {panelOpen ? (
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-slate-200/80 bg-white/60 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.02] xl:block" aria-label="Context">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Context</h2>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
              aria-label="Close context panel"
            >
              <X size={15} />
            </button>
          </div>

          {verification ? (
            <div className={`mb-4 rounded-2xl border p-3 text-xs ${
              verification.status === 'passed'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
            }`}>
              <p className="font-semibold">Fact-check</p>
              <p className="mt-1 leading-5">{verification.notes || 'Claims matched the retrieved sources.'}</p>
            </div>
          ) : null}

          {sources.length ? (
            <div className="space-y-2">
              {sources.map((source) => (
                <a
                  key={`${source.id}-${source.url}`}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow ugc"
                  className="block rounded-xl border border-slate-200 bg-white p-3 transition hover:border-brand-300 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-brand-500/40"
                >
                  <p className="truncate text-[13px] font-medium text-slate-700 dark:text-slate-200">{source.title}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">{source.domain}</p>
                </a>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-xs leading-5 text-slate-400 dark:border-white/10 dark:text-slate-500">
              <AlertCircle size={14} className="mb-1.5" />
              Sources for the latest answer will appear here when web or document retrieval is used.
            </div>
          )}

          {meta ? (
            <div className="mt-5 space-y-2 rounded-2xl border border-slate-200 bg-white p-3 text-[11px] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
              <div className="flex justify-between"><span>Mode</span><span className="font-medium">{meta.mode}</span></div>
              <div className="flex justify-between"><span>Intent</span><span className="font-medium">{meta.intent}</span></div>
              <div className="flex justify-between"><span>Route</span><span className="font-medium">{meta.model}</span></div>
              <div className="flex justify-between"><span>Retrieval</span><span className="font-medium">{meta.retrieval?.sourceCount ?? 0} sources</span></div>
              <div className="flex justify-between"><span>Latency</span><span className="font-medium">{meta.retrieval?.ms ?? 0} ms</span></div>
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
