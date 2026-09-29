import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import AuthShell from './AuthShell.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function Login () {
  const { user, login } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState('');

  if (user) return <Navigate to="/chat" replace />;

  const onSubmit = async (event) => {
    event.preventDefault();
    setFieldError('');
    if (!form.email.trim() || !form.password) {
      setFieldError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      await login(form.email.trim(), form.password);
      const from = location.state?.from;
      navigate(from && from !== '/login' ? from : '/chat', { replace: true });
    } catch (error) {
      push(error.message, 'error');
      setFieldError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue to NovaAI."
      footer={(
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:underline dark:text-brand-300">Create one</Link>
        </>
      )}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            className="input"
            placeholder="you@example.com"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            aria-invalid={Boolean(fieldError)}
            required
            autoFocus
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="login-password">Password</label>
            <Link to="/forgot-password" className="mb-1.5 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="input !pr-11"
              placeholder="Your password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              aria-invalid={Boolean(fieldError)}
              required
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
        </div>

        {fieldError ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300" role="alert">
            {fieldError}
          </p>
        ) : null}

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
}
