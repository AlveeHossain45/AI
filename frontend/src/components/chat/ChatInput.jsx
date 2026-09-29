import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUp, Square, Paperclip, Mic, MicOff, X, FileText, Image as ImageIcon, ChevronDown, Check,
} from 'lucide-react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { startDictation, speechToTextSupported } from '../../services/speech.js';

const MODES = [
  { id: 'AUTO', label: 'Auto', hint: 'AI decides what to retrieve' },
  { id: 'FAST', label: 'Fast', hint: 'Quick, concise answers' },
  { id: 'DEEP', label: 'Deep search', hint: 'Multi-source research with a report' },
  { id: 'DOCUMENTS', label: 'Documents', hint: 'Only your uploaded files' },
  { id: 'WEB', label: 'Web', hint: 'Prioritise live web results' },
];

const ACCEPT = '.pdf,.docx,.txt,.md,.markdown,.csv,.json,.png,.jpg,.jpeg,.gif,.webp,text/plain,application/json';

export default function ChatInput ({
  onSend,
  onStop,
  streaming = false,
  mode = 'AUTO',
  onModeChange,
  enterToSend = true,
  autoFocus = false,
}) {
  const { push } = useToast();
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const dictationRef = useRef(null);
  const modeMenuRef = useRef(null);

  const uploading = attachments.some((item) => item.status === 'uploading');
  const currentMode = MODES.find((item) => item.id === mode) || MODES[0];

  // Auto-grow textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  // Close mode menu on outside click
  useEffect(() => {
    if (!modeOpen) return undefined;
    const handler = (event) => {
      if (!modeMenuRef.current?.contains(event.target)) setModeOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [modeOpen]);

  const uploadFiles = useCallback(async (fileList) => {
    const files = [...fileList].slice(0, 5);
    if (!files.length) return;

    const pending = files.map((file) => ({
      localId: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'uploading',
      fileId: null,
      isImage: file.type.startsWith('image/'),
    }));
    setAttachments((current) => [...current, ...pending].slice(0, 8));

    for (const item of pending) {
      const file = files[pending.indexOf(item)];
      const formData = new FormData();
      formData.append('files', file);
      try {
        // eslint-disable-next-line no-await-in-loop
        const response = await api.upload('/api/files', formData);
        const document = response?.documents?.[0];
        setAttachments((current) => current.map((a) => (a.localId === item.localId
          ? { ...a, status: document?.status === 'READY' ? 'ready' : document?.status === 'FAILED' ? 'error' : 'ready', fileId: document?.id, name: document?.filename || a.name }
          : a)));
        if (document?.status === 'FAILED') push(`Could not process ${document.filename}: ${document.error || 'unknown error'}`, 'error');
      } catch (error) {
        setAttachments((current) => current.map((a) => (a.localId === item.localId ? { ...a, status: 'error' } : a)));
        push(error.message, 'error');
      }
    }
  }, [push]);

  const removeAttachment = (localId) => {
    setAttachments((current) => current.filter((item) => item.localId !== localId));
  };

  const submit = () => {
    const text = value.trim();
    if (!text || streaming || uploading) return;
    const fileIds = attachments.filter((a) => a.fileId && a.isImage && a.status === 'ready').map((a) => a.fileId);
    const documentIds = attachments.filter((a) => a.fileId && !a.isImage && a.status === 'ready').map((a) => a.fileId);
    onSend?.({ content: text, mode, fileIds, documentIds });
    setValue('');
    setAttachments([]);
  };

  const handleKeyDown = (event) => {
    const wantsSend = enterToSend ? event.key === 'Enter' && !event.shiftKey : event.key === 'Enter' && (event.metaKey || event.ctrlKey);
    const wantsNewline = enterToSend ? event.key === 'Enter' && event.shiftKey : event.key === 'Enter' && !event.metaKey && !event.ctrlKey;
    if (wantsSend) {
      event.preventDefault();
      submit();
    } else if (wantsNewline) {
      // allow default newline
    }
  };

  const toggleDictation = () => {
    if (listening) {
      dictationRef.current?.stop();
      setListening(false);
      return;
    }
    const controller = startDictation({
      onResult: (transcript) => setValue((current) => {
        const base = current.trimEnd();
        return base ? `${base} ${transcript}` : transcript;
      }),
      onEnd: () => setListening(false),
      onError: (error) => {
        setListening(false);
        push(error === 'not-allowed' ? 'Microphone permission denied' : 'Voice input stopped', 'error');
      },
    });
    if (!controller) {
      push('Voice input is not supported in this browser', 'info');
      return;
    }
    dictationRef.current = controller;
    setListening(true);
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer?.files?.length) uploadFiles(event.dataTransfer.files);
  };

  const onPaste = (event) => {
    const files = [...(event.clipboardData?.files || [])];
    if (files.length) {
      event.preventDefault();
      uploadFiles(files);
    }
  };

  return (
    <div className="relative">
      {dragging ? (
        <div
          className="absolute -inset-3 z-10 flex items-center justify-center rounded-3xl border-2 border-dashed border-brand-400 bg-brand-50/80 text-sm font-semibold text-brand-600 backdrop-blur dark:bg-brand-500/10 dark:text-brand-300"
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          Drop files to attach
        </div>
      ) : null}

      <div
        className="card rounded-3xl p-2 shadow-card transition focus-within:border-brand-400/60 focus-within:shadow-glow dark:focus-within:border-brand-500/40"
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {attachments.length ? (
          <div className="flex flex-wrap gap-2 px-2 pt-1.5 pb-1">
            {attachments.map((item) => (
              <div
                key={item.localId}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs ${
                  item.status === 'error'
                    ? 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10'
                    : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                }`}
              >
                {item.isImage && item.fileId ? (
                  <img src={`/api/files/${item.fileId}/raw`} alt="" className="h-6 w-6 rounded-md object-cover" />
                ) : item.isImage ? (
                  <ImageIcon size={14} />
                ) : (
                  <FileText size={14} />
                )}
                <span className="max-w-[140px] truncate">{item.name}</span>
                {item.status === 'uploading' ? (
                  <span className="h-3 w-3 animate-spin rounded-full border border-brand-400 border-t-transparent" aria-label="Uploading" />
                ) : item.status === 'ready' ? (
                  <Check size={13} className="text-emerald-500" />
                ) : (
                  <span className="text-rose-500">failed</span>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(item.localId)}
                  className="rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10"
                  aria-label={`Remove ${item.name}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={onPaste}
          rows={1}
          placeholder="Ask NovaAI anything..."
          aria-label="Message NovaAI"
          className="max-h-[200px] w-full resize-none bg-transparent px-3 py-2.5 text-[15px] leading-6 text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
        />

        <div className="flex items-center gap-1.5 px-1 pb-0.5">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(event) => {
              if (event.target.files?.length) uploadFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Attach files"
            title="Attach PDF, DOCX, TXT, MD, CSV, JSON or images"
          >
            <Paperclip size={17} />
          </button>

          {speechToTextSupported() ? (
            <button
              type="button"
              onClick={toggleDictation}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${
                listening
                  ? 'bg-rose-500/15 text-rose-500 animate-pulseSoft'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white'
              }`}
              aria-label={listening ? 'Stop voice input' : 'Start voice input'}
              title={listening ? 'Stop dictation' : 'Dictate'}
            >
              {listening ? <MicOff size={17} /> : <Mic size={17} />}
            </button>
          ) : null}

          <div className="relative" ref={modeMenuRef}>
            <button
              type="button"
              onClick={() => setModeOpen((open) => !open)}
              className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
              aria-haspopup="menu"
              aria-expanded={modeOpen}
              title={currentMode.hint}
            >
              {currentMode.label}
              <ChevronDown size={13} className={modeOpen ? 'rotate-180 transition' : 'transition'} />
            </button>
            {modeOpen ? (
              <div role="menu" className="absolute bottom-11 left-0 z-30 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-card dark:border-white/10 dark:bg-surface-dark-3">
                {MODES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={item.id === mode}
                    onClick={() => { onModeChange?.(item.id); setModeOpen(false); }}
                    className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition ${
                      item.id === mode
                        ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300'
                        : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="flex-1">
                      <span className="block text-[13px] font-semibold">{item.label}</span>
                      <span className="block text-[11px] opacity-70">{item.hint}</span>
                    </span>
                    {item.id === mode ? <Check size={14} className="mt-1" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <span className="hidden flex-1 text-center text-[11px] text-slate-300 dark:text-slate-600 sm:block">
            {enterToSend ? 'Enter to send · Shift+Enter for a new line' : 'Ctrl/⌘+Enter to send'}
          </span>

          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-800 px-3 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-white/15 dark:hover:bg-white/25"
              aria-label="Stop generating"
            >
              <Square size={13} fill="currentColor" />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!value.trim() || uploading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-glow transition hover:from-brand-400 hover:to-brand-600 active:scale-95 disabled:opacity-40 disabled:shadow-none"
              aria-label="Send message"
            >
              <ArrowUp size={17} />
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] text-slate-400 dark:text-slate-600">
        NovaAI can make mistakes. Verify important information.
      </p>
    </div>
  );
}
