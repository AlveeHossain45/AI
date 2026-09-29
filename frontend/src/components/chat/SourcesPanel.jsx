import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ExternalLink, Database, Globe, FileText } from 'lucide-react';

const VIA_ICON = {
  web: Globe,
  knowledge: Database,
  documents: FileText,
};

/**
 * Subtle "Sources" disclosure — hidden when the user disables sources
 * in preferences. Shows where the answer actually came from.
 */
export default function SourcesPanel ({ sources = [], meta = null, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  if (!sources.length && !meta) return null;

  return (
    <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-semibold text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <span className="flex items-center gap-2">
          Sources &amp; details
          {sources.length ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold dark:bg-white/10">
              {sources.length}
            </span>
          ) : null}
        </span>
        <ChevronDown size={14} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-200/80 px-4 py-3 dark:border-white/10">
              {meta ? (
                <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 dark:text-slate-500">
                  <span>Retrieval: {meta.ms ?? 0} ms</span>
                  <span>Searches: {meta.searches ?? 0}</span>
                  <span>Results: {meta.rawCount ?? sources.length}</span>
                  {meta.providers?.length ? <span>Providers: {meta.providers.join(', ')}</span> : null}
                  {meta.degraded ? <span className="text-amber-500">Some sources failed</span> : null}
                </div>
              ) : null}

              {sources.length ? (
                <ul className="space-y-2">
                  {sources.map((source) => {
                    const Icon = VIA_ICON[source.via] || Globe;
                    return (
                      <li key={`${source.id}-${source.url}`}>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow ugc"
                          className="group flex items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-slate-50 dark:hover:bg-white/5"
                        >
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-300">
                            <Icon size={13} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-[13px] font-medium text-slate-700 group-hover:text-brand-600 dark:text-slate-200 dark:group-hover:text-brand-300">
                                {source.title}
                              </span>
                              <ExternalLink size={11} className="shrink-0 text-slate-300 dark:text-slate-600" />
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-slate-400 dark:text-slate-500">
                              {source.domain}
                              {source.publishedAt ? ` · ${source.publishedAt}` : ''}
                              {source.provider ? ` · via ${source.provider}` : ''}
                              {source.synthetic ? ' · demo entry' : ''}
                            </span>
                            {source.snippet ? (
                              <span className="mt-1 line-clamp-2 block text-[11.5px] leading-relaxed text-slate-400 dark:text-slate-500">
                                {source.snippet}
                              </span>
                            ) : null}
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  This answer used the model&apos;s general knowledge — no external sources were retrieved.
                </p>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
