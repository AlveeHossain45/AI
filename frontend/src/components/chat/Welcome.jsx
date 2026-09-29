import { motion } from 'framer-motion';
import {
  Sparkles, Code2, Newspaper, GitCompareArrows, Mail, FileSearch, FlaskConical, BrainCircuit, Bitcoin,
} from 'lucide-react';
import Logo from '../ui/Logo.jsx';

const SUGGESTIONS = [
  { icon: BrainCircuit, text: 'Explain quantum computing like I have five minutes' },
  { icon: Code2, text: 'Explain JavaScript promises with a code example' },
  { icon: GitCompareArrows, text: 'Compare React and Vue for a new dashboard' },
  { icon: Newspaper, text: 'What happened in technology news today?' },
  { icon: Mail, text: 'Write a professional follow-up email after a meeting' },
  { icon: FileSearch, text: 'Summarize the key points of an uploaded document' },
  { icon: FlaskConical, text: 'Solve this math problem step by step: 12x² + 7x − 10 = 0' },
  { icon: Bitcoin, text: 'How does Bitcoin work, from wallets to mining?' },
];

export default function Welcome ({ onSelect, userName, demo = false, grounded = false, mode = 'AUTO' }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-4 py-10 text-center">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center"
      >
        <Logo size="lg" />
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          {greeting}{userName ? `, ${userName}` : ''}
        </h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-slate-500 dark:text-slate-400">
          Ask anything — NovaAI will search, read your documents, research deeply, and explain the answer
          with sources.
        </p>
        {demo ? (
          <div className="mt-4 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            Demo providers active — add API keys in <code className="font-mono">.env</code> for live AI &amp; web search
          </div>
        ) : grounded ? (
          <div className="mt-4 rounded-full border border-sky-200 bg-sky-50 px-4 py-1.5 text-xs font-medium text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
            Grounded answers from live open sources — configure an AI key in <code className="font-mono">.env</code> for generative synthesis
          </div>
        ) : null}
        {mode !== 'AUTO' ? (
          <div className="mt-3 text-xs font-medium text-brand-500">
            Mode: {mode}
          </div>
        ) : null}
      </motion.div>

      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion, index) => (
          <motion.button
            key={suggestion.text}
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.06 * index }}
            onClick={() => onSelect(suggestion.text)}
            className="group flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-brand-500/40"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 transition group-hover:bg-brand-500 group-hover:text-white dark:bg-brand-500/15 dark:group-hover:bg-brand-500">
              <suggestion.icon size={16} />
            </span>
            <span className="text-sm leading-6 text-slate-600 dark:text-slate-300">{suggestion.text}</span>
          </motion.button>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
        <Sparkles size={13} />
        <span>Powered by configurable AI providers · answers cite their sources</span>
      </div>
    </div>
  );
}
