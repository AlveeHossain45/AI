import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import AuthShell from './AuthShell.jsx';
import { api } from '../../api/client.js';

export default function VerifyEmail () {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState(token ? 'verifying' : 'invalid');
  const [message, setMessage] = useState('');
  const startedRef = useRef(false);

  useEffect(() => {
    if (!token || startedRef.current) return;
    startedRef.current = true;
    api.post('/api/auth/verify-email', { token })
      .then(() => setState('success'))
      .catch((error) => {
        setState('failed');
        setMessage(error.message);
      });
  }, [token]);

  return (
    <AuthShell
      title="Email verification"
      subtitle="Confirming your email address to activate your account."
      footer={(
        <>
          Need a new link?{' '}
          <Link to="/forgot-password" className="font-semibold text-brand-600 hover:underline dark:text-brand-300">Reset your password</Link>
        </>
      )}
    >
      <div className="py-4 text-center">
        {state === 'verifying' ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={28} className="animate-spin text-brand-500" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Verifying your email…</p>
          </div>
        ) : null}

        {state === 'success' ? (
          <div className="flex flex-col items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
              <CheckCircle2 size={28} />
            </span>
            <div>
              <p className="font-semibold text-slate-800 dark:text-white">Email verified</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your NovaAI account is ready.</p>
            </div>
            <Link to="/chat" className="btn-primary w-full">
              Continue to NovaAI <ArrowRight size={16} />
            </Link>
          </div>
        ) : null}

        {(state === 'failed' || state === 'invalid') ? (
          <div className="flex flex-col items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/15 text-rose-500">
              <AlertTriangle size={26} />
            </span>
            <div>
              <p className="font-semibold text-slate-800 dark:text-white">Verification failed</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {message || 'This verification link is invalid or has expired.'}
              </p>
            </div>
            <Link to="/login" className="btn-outline w-full">Back to sign in</Link>
          </div>
        ) : null}
      </div>
    </AuthShell>
  );
}
