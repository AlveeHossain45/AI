import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.jsx';

const ORDER = ['light', 'dark', 'system'];
const NEXT = { light: 'dark', dark: 'system', system: 'light' };
const ICONS = { light: Sun, dark: Moon, system: Monitor };
const LABELS = { light: 'Light mode', dark: 'Dark mode', system: 'System theme' };

export default function ThemeToggle ({ className = '' }) {
  const { theme, setTheme, resolved } = useTheme();
  const Icon = ICONS[theme] || (resolved === 'dark' ? Moon : Sun);

  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT[theme] || ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length])}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white ${className}`}
      aria-label={`${LABELS[theme] || 'Theme'} — click to change`}
      title={`${LABELS[theme] || 'Theme'} (click to change)`}
    >
      <Icon size={17} />
    </button>
  );
}
