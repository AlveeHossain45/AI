import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Menu, Users, Activity, Search as SearchIcon, MessageSquare, FileText, Coins, AlertTriangle,
  Server, Settings as SettingsIcon, RefreshCw, ShieldCheck, Ban, Check,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
  { id: 'system', label: 'System', icon: Server },
];

function StatCard ({ icon: Icon, label, value, sub, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-500/10 text-brand-500 dark:text-brand-300',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
  };
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone] || tones.brand}`}>
          <Icon size={17} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs text-slate-400">{label}</p>
          <p className="truncate text-lg font-bold text-slate-900 dark:text-white">{value}</p>
          {sub ? <p className="truncate text-[11px] text-slate-400">{sub}</p> : null}
        </div>
      </div>
    </div>
  );
}

const formatNumber = (value) => {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
};

export default function Admin () {
  const { openSidebar } = useOutletContext();
  const { push } = useToast();
  const [tab, setTab] = useState('overview');
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [settings, setSettings] = useState(null);
  const [system, setSystem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsData, usersData, settingsData, systemData] = await Promise.all([
        api.get('/api/admin/analytics?days=30'),
        api.get('/api/admin/users?limit=50'),
        api.get('/api/admin/settings'),
        api.get('/api/admin/system'),
      ]);
      setAnalytics(analyticsData);
      setUsers(usersData.users || []);
      setSettings(settingsData.settings);
      setSystem(systemData);
    } catch (error) {
      push(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const saveSettings = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api.patch('/api/admin/settings', settings);
      setSettings(data.settings);
      push('Settings saved', 'success');
    } catch (error) {
      push(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateUser = async (id, patch) => {
    try {
      const data = await api.patch(`/api/admin/users/${id}`, patch);
      setUsers((current) => current.map((user) => (user.id === id ? { ...user, ...data.user } : user)));
      push('User updated', 'success');
    } catch (error) {
      push(error.message, 'error');
    }
  };

  const maxDaily = Math.max(1, ...(analytics?.ai?.daily || []).map((day) => day.requests));

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
        <h1 className="text-sm font-semibold text-slate-800 dark:text-white">Admin dashboard</h1>
        <button
          type="button"
          onClick={loadAll}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </header>

      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200/80 px-4 py-2 dark:border-white/10">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              tab === item.id
                ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300'
                : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'
            }`}
            aria-current={tab === item.id}
          >
            <item.icon size={14} />
            {item.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
          {loading && !analytics ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((index) => <div key={index} className="skeleton h-24 rounded-2xl" />)}
            </div>
          ) : null}

          {tab === 'overview' && analytics ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard icon={Users} label="Total users" value={analytics.users.total} sub={`${analytics.users.active} active (30d)`} />
                <StatCard icon={MessageSquare} label="Conversations" value={formatNumber(analytics.conversations)} sub={`${formatNumber(analytics.messages)} messages`} tone="violet" />
                <StatCard icon={Activity} label="AI requests" value={formatNumber(analytics.ai.requests)} sub={`${analytics.ai.avgLatencyMs} ms avg`} tone="emerald" />
                <StatCard icon={Coins} label="Est. cost (30d)" value={`$${analytics.ai.estimatedCost.toFixed(2)}`} sub={`${formatNumber(analytics.ai.totalTokens)} tokens`} tone="amber" />
                <StatCard icon={SearchIcon} label="Search queries" value={formatNumber(analytics.search.queries)} sub={`${formatNumber(analytics.search.results)} results stored`} />
                <StatCard icon={FileText} label="Documents" value={formatNumber(analytics.documents)} sub="uploaded files" tone="violet" />
                <StatCard icon={AlertTriangle} label="Error rate" value={`${(analytics.ai.errorRate * 100).toFixed(1)}%`} sub="of AI requests" tone={analytics.ai.errorRate > 0.05 ? 'rose' : 'emerald'} />
                <StatCard icon={ShieldCheck} label="Feedback" value={(analytics.feedback.find((f) => f.rating === 'LIKE')?.count || 0)} sub={`${analytics.feedback.find((f) => f.rating === 'DISLIKE')?.count || 0} dislikes`} tone="amber" />
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <div className="card p-5 lg:col-span-2">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Daily AI requests</h2>
                  <div className="mt-4 flex h-40 items-end gap-1.5">
                    {(analytics.ai.daily.length ? analytics.ai.daily : [{ day: 'n/a', requests: 0 }]).map((day) => (
                      <div key={day.day} className="group relative flex-1" title={`${day.day}: ${day.requests} requests`}>
                        <div
                          className="w-full rounded-t-md bg-gradient-to-t from-brand-500 to-brand-400 transition group-hover:from-violet-500"
                          style={{ height: `${Math.max(4, (day.requests / maxDaily) * 140)}px` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                    <span>{analytics.ai.daily[0]?.day || '—'}</span>
                    <span>{analytics.ai.daily[analytics.ai.daily.length - 1]?.day || '—'}</span>
                  </div>
                </div>

                <div className="card p-5">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Provider usage</h2>
                  <ul className="mt-3 space-y-2.5">
                    {(analytics.ai.byProvider.length ? analytics.ai.byProvider : [{ provider: 'none', requests: 0 }]).map((row) => (
                      <li key={row.provider} className="flex items-center justify-between text-xs">
                        <span className="capitalize text-slate-500 dark:text-slate-400">{row.provider}</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{row.requests}</span>
                      </li>
                    ))}
                  </ul>
                  <h2 className="mt-5 text-sm font-semibold text-slate-800 dark:text-white">Model usage</h2>
                  <ul className="mt-3 space-y-2.5">
                    {(analytics.ai.byModel.length ? analytics.ai.byModel : [{ model: 'none', requests: 0 }]).map((row) => (
                      <li key={row.model} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-slate-500 dark:text-slate-400">{row.model}</span>
                        <span className="shrink-0 font-semibold text-slate-700 dark:text-slate-200">{row.requests}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          ) : null}

          {tab === 'users' ? (
            <div className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4 dark:border-white/10">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Users</h2>
                <input
                  type="search"
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Search by email or name"
                  className="input !w-auto flex-1 !py-2 text-xs"
                  aria-label="Search users"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/10">
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">30d usage</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users
                      .filter((user) => {
                        const needle = userSearch.toLowerCase();
                        return !needle || user.email.toLowerCase().includes(needle) || (user.name || '').toLowerCase().includes(needle);
                      })
                      .map((user) => (
                        <tr key={user.id} className="border-b border-slate-100 last:border-0 dark:border-white/5">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-700 dark:text-slate-200">{user.name || '—'}</p>
                            <p className="text-[11px] text-slate-400">{user.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={user.role}
                              onChange={(event) => updateUser(user.id, { role: event.target.value })}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5"
                              aria-label={`Role for ${user.email}`}
                            >
                              <option value="USER">USER</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            {user.usage30d?.requests || 0} req · {formatNumber(user.usage30d?.tokens || 0)} tok
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${user.isSuspended ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'}`}>
                              {user.isSuspended ? 'Suspended' : 'Active'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => updateUser(user.id, { isSuspended: !user.isSuspended })}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-500 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
                            >
                              {user.isSuspended ? <><Check size={11} /> Reinstate</> : <><Ban size={11} /> Suspend</>}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === 'settings' && settings ? (
            <form onSubmit={saveSettings} className="card space-y-4 p-5">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Global settings</h2>

              <div>
                <label className="label" htmlFor="system-prompt">System prompt override</label>
                <textarea
                  id="system-prompt"
                  rows={4}
                  className="input font-mono text-xs"
                  placeholder="Leave empty to use the built-in NovaAI prompt"
                  value={settings.system_prompt || ''}
                  onChange={(event) => setSettings({ ...settings, system_prompt: event.target.value })}
                />
              </div>

              <div>
                <label className="label" htmlFor="blocked-domains">Blocked domains (comma separated)</label>
                <input
                  id="blocked-domains"
                  className="input text-xs"
                  value={(settings.blocked_domains || []).join(', ')}
                  onChange={(event) => setSettings({
                    ...settings,
                    blocked_domains: event.target.value.split(',').map((value) => value.trim()).filter(Boolean),
                  })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="max-searches">Deep research — max searches</label>
                  <input
                    id="max-searches"
                    type="number"
                    min="1"
                    max="50"
                    className="input"
                    value={settings.deep_research_max_searches || 6}
                    onChange={(event) => setSettings({ ...settings, deep_research_max_searches: Number(event.target.value) })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="rate-limit">Chat rate limit (per minute)</label>
                  <input
                    id="rate-limit"
                    type="number"
                    min="1"
                    max="1000"
                    className="input"
                    value={settings.chat_rate_limit_max || 20}
                    onChange={(event) => setSettings({ ...settings, chat_rate_limit_max: Number(event.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { key: 'show_sources', label: 'Show sources panel by default' },
                  { key: 'fact_check', label: 'Enable fact-checking layer (requires a live AI provider)' },
                  { key: 'allow_registration', label: 'Allow new registrations' },
                  { key: 'maintenance_mode', label: 'Maintenance mode (blocks new chat/research requests)' },
                ].map((item) => (
                  <label key={item.key} className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={Boolean(settings[item.key])}
                      onChange={(event) => setSettings({ ...settings, [item.key]: event.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-300">{item.label}</span>
                  </label>
                ))}
              </div>

              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save settings'}
              </button>
            </form>
          ) : null}

          {tab === 'system' && system ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Runtime</h2>
                <dl className="mt-3 space-y-2 text-xs">
                  {[
                    ['Environment', system.env],
                    ['Database', `${system.database.mode}${system.database.configured ? '' : ' (no DATABASE_URL)'}`],
                    ['Vector store', system.vector.provider],
                    ['AI provider', `${system.ai.label || 'not configured'}${system.ai.demo ? ' — demo' : ''}`],
                    ['Search provider', `${system.search.configured}${system.search.available.length ? ` (${system.search.available.map((p) => p.id).join(', ')})` : ''}`],
                    ['Embeddings', system.embedding ? `${system.embedding.provider} · ${system.embedding.dimensions}d` : 'unavailable'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 dark:border-white/5">
                      <dt className="text-slate-400">{label}</dt>
                      <dd className="truncate font-medium capitalize text-slate-700 dark:text-slate-200">{value}</dd>
                    </div>
                  ))}
                </dl>
                <button type="button" className="btn-outline mt-4 w-full" onClick={async () => {
                  try {
                    await api.post('/api/admin/system/reload-providers', {});
                    const data = await api.get('/api/admin/system');
                    setSystem(data);
                    push('Provider configuration reloaded', 'success');
                  } catch (error) {
                    push(error.message, 'error');
                  }
                }}>
                  <RefreshCw size={14} /> Reload providers
                </button>
              </div>

              <div className="card p-5">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Knowledge connectors</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {system.knowledgeConnectors.map((connector) => (
                    <span key={connector.id} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                      {connector.label}
                    </span>
                  ))}
                </div>
                <h2 className="mt-5 text-sm font-semibold text-slate-800 dark:text-white">Limits</h2>
                <dl className="mt-3 space-y-2 text-xs">
                  {[
                    ['Max upload', `${system.limits.maxFileMb} MB`],
                    ['Chat rate limit', `${system.limits.chatRateLimit}/min`],
                    ['Context budget', `${system.limits.contextMaxTokens} tokens`],
                    ['Research searches', system.limits.research.maxSearches],
                    ['Research sources', system.limits.research.maxSources],
                    ['Research time budget', `${Math.round(system.limits.research.maxTimeMs / 1000)}s`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 dark:border-white/5">
                      <dt className="text-slate-400">{label}</dt>
                      <dd className="font-medium text-slate-700 dark:text-slate-200">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
