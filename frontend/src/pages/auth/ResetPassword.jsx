import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import AuthShell from './AuthShell.jsx';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function ResetPassword () {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const { push } = useToast();

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    setSubmitting(true);
    try {
      await api.post('/api/auth/reset-password', { token, password: form.password });
      setDone(true);
    } catch (err) {
      setError(err.message);
      push(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthShell title="Invalid link" subtitle="This password reset link is missing its token.">
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <p className="leading-6">Request a fresh link from the forgot-password page.</p>
        </div>
        <Link to="/forgot-password" className="btn-primary mt-4 w-full">Request a new link</Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="Your password has been changed successfully.">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
            <CheckCircle2 size={24} />
          </span>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">You can now sign in with your new password.</p>
          <button type="button" onClick={() => navigate('/login')} className="btn-primary mt-5 w-full">
            Go to sign in
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Pick something strong — at least 8 characters.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="reset-password">New password</label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            className="input"
            placeholder="New password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required
            minLength={8}
            autoFocus
          />
        </div>
        <div>
          <label className="label" htmlFor="reset-confirm">Confirm new password</label>
          <input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            className="input"
            placeholder="Repeat new password"
            value={form.confirm}
            onChange={(event) => setForm({ ...form, confirm: event.target.value })}
            required
          />
        </div>

        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </AuthShell>
  );
}
