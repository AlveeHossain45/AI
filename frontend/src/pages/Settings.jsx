import { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  Menu, Sun, Moon, Monitor, MessageSquare, Globe, FileText, Gauge, Mic, Eye, Lock, ShieldCheck, Activity,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../api/client.js';

function Section ({ title, description, children }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Toggle ({ checked, onChange, label, hint, icon: Icon }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      {Icon ? (
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300">
          <Icon size={15} />
        </span>
      ) : null}
      <span className="flex-1">
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-slate-400">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-brand-500' : 'bg-slate-300 dark:bg-white/15'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

const MODES = [
  { id: 'AUTO', label: 'Auto', hint: 'AI decides' },
  { id: 'FAST', label: 'Fast', hint: 'Concise' },
  { id: 'DEEP', label: 'Deep search', hint: 'Research' },
  { id: 'DOCUMENTS', label: 'Documents', hint: 'Your files' },
  { id: 'WEB', label: 'Web', hint: 'Live results' },
];

export default function Settings () {
  const { openSidebar } = useOutletContext();
  const { user, preferences, updatePreferences, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const { push } = useToast();
  const navigate = useNavigate();

  const [provider, setProvider] = useState(null);
  const [usage, setUsage] = useState(null);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    api.get('/api/chat/providers').then(setProvider).catch(() => setProvider(null));
    api.get('/api/user/usage').then((data) => setUsage(data.usage)).catch(() => {});
  }, []);

  const setPref = (patch) => {
    updatePreferences(patch).catch((error) => push(error.message, 'error'));
  };

  const changeTheme = (value) => {
    setTheme(value);
    setPref({ theme: value });
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    if (passwords.next !== passwords.confirm) {
      push('New passwords do not match', 'error');
      return;
    }
    if (passwords.next.length < 8) {
      push('New password must be at least 8 characters', 'error');
      return;
    }
    setSavingPassword(true);
    try {
      await api.post('/api/auth/change-password', { currentPassword: passwords.current, newPassword: passwords.next });
      push('Password updated', 'success');
      setPasswords({ current: '', next: '', confirm: '' });
    } catch (error) {
      push(error.message, 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const themeOptions = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/70 px-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]">
        <button
          type="button"
          onClick={openSidebar}
          className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10 lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
        <h1 className="text-sm font-semibold text-slate-800 dark:text-white">Settings</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
          <Section title="Appearance" description="Choose how NovaAI looks on this device.">
            <div className="grid grid-cols-3 gap-3">
              {themeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => changeTheme(option.id)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-medium transition ${
                    theme === option.id
                      ? 'border-brand-400 bg-brand-50 text-brand-600 shadow-glow dark:bg-brand-500/10 dark:text-brand-300'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-white/10 dark:text-slate-400 dark:hover:border-white/20'
                  }`}
                  aria-pressed={theme === option.id}
                >
                  <option.icon size={18} />
                  {option.label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Chat" description="Defaults applied to new messages.">
            <div>
              <span className="label">Default search mode</span>
              <div className="flex flex-wrap gap-2">
                {MODES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPref({ mode: item.id })}
                    className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                      preferences.mode === item.id
                        ? 'border-brand-400 bg-brand-500/10 text-brand-600 dark:text-brand-300'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-white/10 dark:text-slate-400'
                    }`}
                    aria-pressed={preferences.mode === item.id}
                  >
                    {item.label}
                    <span className="ml-1.5 font-normal opacity-70">{item.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <Toggle
              icon={MessageSquare}
              label="Enter to send"
              hint="When off, use Ctrl/⌘ + Enter to send."
              checked={preferences.enterToSend !== false}
              onChange={(value) => setPref({ enterToSend: value })}
            />
            <Toggle
              icon={Eye}
              label="Show sources"
              hint="Display the sources & details disclosure under answers."
              checked={preferences.showSources !== false}
              onChange={(value) => setPref({ showSources: value })}
            />
            <Toggle
              icon={Mic}
              label="Read answers aloud automatically"
              hint="Uses your browser's speech synthesis after each answer."
              checked={Boolean(preferences.speakAnswers)}
              onChange={(value) => setPref({ speakAnswers: value })}
            />
          </Section>

          <Section title="Account" description={`${user?.email || ''} · role ${user?.role || 'USER'}`}>
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 p-4 dark:border-white/10">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-violet-600 text-sm font-bold text-white">
                {(user?.name || user?.email || '?').slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{user?.name}</p>
                <p className="truncate text-xs text-slate-400">{user?.email}</p>
              </div>
              {usage ? (
                <div className="text-right text-xs text-slate-400">
                  <p className="font-semibold text-slate-600 dark:text-slate-300">{usage.requests} requests</p>
                  <p>{usage.tokens} tokens · 30d</p>
                </div>
              ) : null}
            </div>

            <form onSubmit={submitPassword} className="space-y-3">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Change password</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  type="password"
                  className="input"
                  placeholder="Current password"
                  autoComplete="current-password"
                  value={passwords.current}
                  onChange={(event) => setPasswords({ ...passwords, current: event.target.value })}
                  required
                />
                <input
                  type="password"
                  className="input"
                  placeholder="New password"
                  autoComplete="new-password"
                  value={passwords.next}
                  onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
                  required
                  minLength={8}
                />
                <input
                  type="password"
                  className="input"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  value={passwords.confirm}
                  onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
                  required
                />
              </div>
              <button type="submit" className="btn-outline" disabled={savingPassword}>
                <Lock size={14} />
                {savingPassword ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </Section>

          <Section title="Integrations & privacy">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 dark:border-white/10">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">AI provider</p>
                <p className="text-xs text-slate-400">
                  {provider ? `${provider.label}${provider.demo ? ' — demo mode' : ''}` : 'Not configured'}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${provider?.demo ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'}`}>
                {provider?.demo ? 'Demo' : 'Live'}
              </span>
            </div>
            <Toggle
              icon={Activity}
              label="Usage analytics"
              hint="Record counts, latency, model and token usage — never message content. Turn off to stop recording."
              checked={!preferences.analyticsOptOut}
              onChange={(value) => setPref({ analyticsOptOut: !value })}
            />
            {isAdmin ? (
              <button type="button" className="btn-outline w-full" onClick={() => navigate('/admin')}>
                <ShieldCheck size={15} /> Open admin dashboard
              </button>
            ) : null}
          </Section>

          <div className="flex items-center justify-center gap-4 pb-8 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5"><Gauge size={13} /> rate-limited API</span>
            <span className="inline-flex items-center gap-1.5"><Globe size={13} /> cited sources</span>
            <span className="inline-flex items-center gap-1.5"><FileText size={13} /> RAG files</span>
          </div>
        </div>
      </div>
    </div>
  );
}
