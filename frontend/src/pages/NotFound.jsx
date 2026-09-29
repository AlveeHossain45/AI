import { Link } from 'react-router-dom';
import { Compass, MessageSquare } from 'lucide-react';
import Logo from '../components/ui/Logo.jsx';
import ThemeToggle from '../components/ui/ThemeToggle.jsx';

export default function NotFound () {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center dark:bg-surface-dark">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <Logo size="lg" to="/" />

      <p className="mt-10 text-7xl font-extrabold tracking-tight text-slate-200 sm:text-8xl dark:text-white/10">404</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
        This page drifted off into the void.
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
        The link may be outdated, or the page never existed. Your conversations are still safe.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link to="/" className="btn-primary">
          <Compass size={16} /> Go home
        </Link>
        <Link to="/chat" className="btn-outline">
          <MessageSquare size={16} /> Open chat
        </Link>
      </div>
    </div>
  );
}
