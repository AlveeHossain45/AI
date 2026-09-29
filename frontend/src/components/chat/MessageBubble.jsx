import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Copy, Check, RefreshCw, ThumbsUp, ThumbsDown, Share2, Volume2, VolumeX, Pencil, Sparkles, AlertTriangle,
} from 'lucide-react';
import Answer from './Answer.jsx';
import { api } from '../../api/client.js';
import { speak, stopSpeaking, textToSpeechSupported } from '../../services/speech.js';
import { useToast } from '../../context/ToastContext.jsx';

function IconButton ({ label, onClick, active = false, children, disabled = false }) {
  const activeClass = 'bg-brand-500/15 text-brand-600 dark:text-brand-300';
  const idleClass = 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:opacity-40 ${active ? activeClass : idleClass}`}
    >
      {children}
    </button>
  );
}

export default function MessageBubble ({ message, sources = [], onRegenerate, onFeedback, streaming = false }) {
  const { push } = useToast();
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [feedback, setFeedback] = useState(message.feedback?.rating || null);
  const isUser = message.role === 'user';
  const metadata = message.metadata || {};

  const copyText = async (text, notify = true) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      if (notify) push('Copied to clipboard', 'success', 2000);
    } catch {
      push('Could not access the clipboard', 'error');
    }
  };

  const handleShare = async () => {
    const url = window.location.origin + window.location.pathname;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'NovaAI answer', text: message.content.slice(0, 400), url });
        return;
      } catch { /* cancelled */ }
    }
    await copyText(url, false);
    push('Conversation link copied', 'success');
  };

  const handleSpeak = () => {
    if (!textToSpeechSupported()) {
      push('Read-aloud is not supported in this browser', 'info');
      return;
    }
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const stop = speak(message.content);
    setSpeaking(true);
    const poll = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        setSpeaking(false);
        clearInterval(poll);
      }
    }, 500);
    void stop;
  };

  const handleFeedback = async (rating) => {
    const previous = feedback;
    const next = feedback === rating ? null : rating;
    setFeedback(next);
    if (!next) return;
    try {
      await api.post('/api/feedback', { messageId: message.id, rating });
      onFeedback?.(message.id, rating);
    } catch (error) {
      setFeedback(previous);
      push(error.message, 'error');
    }
  };

  const submitEdit = () => {
    const value = draft.trim();
    setEditing(false);
    if (!value || value === message.content) return;
    onRegenerate?.(value);
  };

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="group flex justify-end"
      >
        <div className="max-w-[85%] sm:max-w-[75%]">
          {editing ? (
            <div className="card p-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={4}
                className="input resize-none"
                autoFocus
                aria-label="Edit message"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" className="btn-ghost !py-1.5 text-xs" onClick={() => setEditing(false)}>Cancel</button>
                <button type="button" className="btn-primary !py-1.5 text-xs" onClick={submitEdit}>Send</button>
              </div>
            </div>
          ) : (
            <div className="whitespace-pre-wrap break-words rounded-3xl rounded-br-lg bg-gradient-to-b from-brand-500 to-brand-600 px-4 py-2.5 text-[15px] leading-7 text-white shadow-soft">
              {message.content}
            </div>
          )}
          {!editing && !streaming && (
            <div className="mt-1 flex justify-end gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
              <IconButton label="Copy message" onClick={() => copyText(message.content)}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </IconButton>
              <IconButton label="Edit and resend" onClick={() => { setDraft(message.content); setEditing(true); }}>
                <Pencil size={14} />
              </IconButton>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  const sourceCount = Array.isArray(metadata.sources) ? metadata.sources.length : (typeof metadata.sources === 'number' ? metadata.sources : sources.length);
  const verification = metadata.verification;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="group"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-violet-600 text-white">
          <Sparkles size={14} />
        </span>
        <span className="text-sm font-semibold text-slate-800 dark:text-white">NovaAI</span>
        {metadata.model ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-white/10 dark:text-slate-400">
            {metadata.model}
          </span>
        ) : null}
        {metadata.demo ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            Demo mode
          </span>
        ) : null}
        {metadata.grounded ? (
          <span
            className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
            title="Answer assembled from retrieved, cited sources (no generative model configured)"
          >
            Grounded
          </span>
        ) : null}
        {metadata.stopped ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-white/10">Stopped</span>
        ) : null}
      </div>

      <div className={`pl-9 ${streaming ? 'streaming-caret' : ''}`}>
        {message.content ? (
          <Answer content={message.content} />
        ) : streaming ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-pulseSoft rounded-full bg-brand-400" />
              <span className="h-1.5 w-1.5 animate-pulseSoft rounded-full bg-brand-400 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulseSoft rounded-full bg-brand-400 [animation-delay:300ms]" />
            </span>
            Thinking
          </div>
        ) : null}
        {message.error ? (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertTriangle size={15} /> The response was interrupted.
          </div>
        ) : null}
      </div>

      {!streaming && message.content ? (
        <div className="mt-2 flex flex-wrap items-center gap-1 pl-9 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <IconButton label="Copy answer" onClick={() => copyText(message.content)}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </IconButton>
          {onRegenerate ? (
            <IconButton label="Regenerate answer" onClick={() => onRegenerate(null)}>
              <RefreshCw size={14} />
            </IconButton>
          ) : null}
          <IconButton label="Like this answer" active={feedback === 'LIKE'} onClick={() => handleFeedback('LIKE')}>
            <ThumbsUp size={14} />
          </IconButton>
          <IconButton label="Dislike this answer" active={feedback === 'DISLIKE'} onClick={() => handleFeedback('DISLIKE')}>
            <ThumbsDown size={14} />
          </IconButton>
          <IconButton label="Share" onClick={handleShare}>
            <Share2 size={14} />
          </IconButton>
          <IconButton label={speaking ? 'Stop reading' : 'Read aloud'} active={speaking} onClick={handleSpeak}>
            {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </IconButton>

          {sourceCount > 0 ? (
            <span className="ml-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:bg-white/10 dark:text-slate-400">
              {sourceCount} source{sourceCount === 1 ? '' : 's'}
            </span>
          ) : null}
          {verification ? (
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                verification.status === 'passed'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
              }`}
              title={verification.notes || 'Claims checked against retrieved sources'}
            >
              {verification.status === 'passed' ? 'Verified' : 'Partial support'}
            </span>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
}
