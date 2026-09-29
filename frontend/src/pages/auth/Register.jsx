import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus, Loader2 } from 'lucide-react';
import AuthShell from './AuthShell.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const PASSWORD_RULES = [
  { test: (value) => value.length >= 8, label: '8+ characters' },
  { test: (value) => /[a-zA-Z]/.test(value), label: 'a letter' },
  { test: (value) => /[0-9]/.test(value), label: 'a number' },
];

export default function Register () {
  const { user, register } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Navigate to="/chat" replace />;

  const rulesOk = PASSWORD_RULES.every((rule) => rule.test(form.password));

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.email.trim()) return setError('Enter your email address.');
    if (!rulesOk) return setError('Password does not meet the requirements.');
    if (form.password !== form.confirm) return setError('Passwords do not match.');

    setSubmitting(true);
    try {
      await register({
        email: form.email.trim(),
        password: form.password,
        ...(form.name.trim() ? { name: form.name.trim() } : {}),
      });
      push('Welcome to NovaAI!', 'success');
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err.message);
      push(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free to start. Bring your own AI keys when you deploy."
      footer={(
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-300">Sign in</Link>
        </>
      )}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="reg-name">Name <span className="font-normal text-slate-400">(optional)</span></label>
          <input
            id="reg-name"
            type="text"
            autoComplete="name"
            className="input"
            placeholder="Ada Lovelace"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </div>

        <div>
          <label className="label" htmlFor="reg-email">Email</label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            className="input"
            placeholder="you@example.com"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="reg-password">Password</label>
          <div className="relative">
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="input !pr-11"
              placeholder="Choose a strong password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <ul className="mt-2 flex flex-wrap gap-2 text-[11px]">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(form.password);
              return (
                <li key={rule.label} className={`rounded-full px-2 py-0.5 ${ok ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 text-slate-400 dark:bg-white/10 dark:text-slate-500'}`}>
                  {rule.label}
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <label className="label" htmlFor="reg-confirm">Confirm password</label>
          <input
            id="reg-confirm"
            type="password"
            autoComplete="new-password"
            className="input"
            placeholder="Repeat your password"
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
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
}
