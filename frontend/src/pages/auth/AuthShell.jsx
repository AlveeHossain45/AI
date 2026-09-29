import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Logo from '../../components/ui/Logo.jsx';
import ThemeToggle from '../../components/ui/ThemeToggle.jsx';

/** Shared centred layout for authentication pages. */
export default function AuthShell ({ title, subtitle, children, footer }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-surface-dark">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[380px] w-[640px] -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-500/20 via-violet-500/15 to-fuchsia-500/10 blur-3xl" aria-hidden="true" />

      <Link
        to="/"
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <ArrowLeft size={15} /> Home
      </Link>
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md animate-fadeUp">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" to="/" />
        </div>

        <div className="card p-7 shadow-card sm:p-8">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>

        {footer ? <div className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">{footer}</div> : null}
      </div>
    </div>
  );
}
