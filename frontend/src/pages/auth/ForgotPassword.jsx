import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Loader2, MailCheck } from 'lucide-react';
import AuthShell from './AuthShell.jsx';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function ForgotPassword () {
  const { push } = useToast();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const data = await api.post('/api/auth/forgot-password', { email: email.trim() });
      setResult(data);
    } catch (error) {
      push(error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We will email you a secure link that expires in one hour."
      footer={(
        <>
          Remembered it?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-300">Back to sign in</Link>
        </>
      )}
    >
      {result ? (
        <div className="space-y-4 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
            <MailCheck size={22} />
          </span>
          <p className="text-sm text-slate-600 dark:text-slate-300">If that email exists, a reset link has been sent.</p>
          {result.devUrl ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <p className="font-semibold">Development mode</p>
              <p className="mt-1 leading-5">No SMTP server is configured, so the link was logged to the server console:</p>
              <a href={result.devUrl} className="mt-1 block break-all font-medium underline">{result.devUrl}</a>
            </div>
          ) : null}
          <Link to="/login" className="btn-outline w-full">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoFocus
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
