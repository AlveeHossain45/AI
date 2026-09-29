import { motion } from 'framer-motion';

const STAGE_LABELS = {
  prepare: 'Preparing request',
  analyze: 'Understanding your question',
  retrieve: 'Searching sources',
  search: 'Searching the web',
  knowledge: 'Consulting open knowledge sources',
  decompose: 'Breaking the question into subquestions',
  synthesize: 'Comparing sources',
  generate: 'Generating answer',
  verify: 'Checking claims against sources',
};

/** Live pipeline status shown while an answer is being produced. */
export default function StatusIndicator ({ status }) {
  if (!status) return null;
  const label = status.detail || STAGE_LABELS[status.stage] || 'Working';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mb-3 inline-flex items-center gap-2.5 rounded-full border border-brand-200/70 bg-brand-50/70 px-3.5 py-1.5 text-xs font-medium text-brand-700 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-200"
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
      </span>
      <span className="max-w-[70vw] truncate">{label}</span>
    </motion.div>
  );
}
