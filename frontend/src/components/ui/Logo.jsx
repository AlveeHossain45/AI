import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

/**
 * NovaAI brand mark. `to` renders a router Link, otherwise a plain mark.
 */
export default function Logo ({ size = 'md', to = null, onClick = null }) {
  const sizes = {
    sm: { box: 'h-7 w-7', icon: 15, text: 'text-base' },
    md: { box: 'h-9 w-9', icon: 19, text: 'text-lg' },
    lg: { box: 'h-12 w-12', icon: 26, text: 'text-2xl' },
  };
  const style = sizes[size] || sizes.md;

  const mark = (
    <span className="flex items-center gap-2.5">
      <span
        className={`${style.box} inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 via-brand-500 to-violet-600 text-white shadow-glow`}
        aria-hidden="true"
      >
        <Sparkles size={style.icon} />
      </span>
      <span className={`${style.text} font-bold tracking-tight text-slate-900 dark:text-white`}>
        Nova<span className="bg-gradient-to-r from-brand-400 to-violet-400 bg-clip-text text-transparent">AI</span>
      </span>
    </span>
  );

  if (to) {
    return (
      <Link to={to} className="inline-flex items-center" aria-label="NovaAI home" onClick={onClick}>
        {mark}
      </Link>
    );
  }
  return <span className="inline-flex items-center" onClick={onClick}>{mark}</span>;
}
