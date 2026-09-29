import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Globe, FileText, Microscope, Zap, MessagesSquare, Lock, ArrowRight, Check, Menu, X,
  Search, Shield, Database, ChevronDown, Sparkles, Brain, Quote,
} from 'lucide-react';
import Logo from '../components/ui/Logo.jsx';
import ThemeToggle from '../components/ui/ThemeToggle.jsx';

const NAV = [
  { id: 'features', label: 'Features' },
  { id: 'how', label: 'How it works' },
  { id: 'research', label: 'Research' },
  { id: 'security', label: 'Security' },
  { id: 'faq', label: 'FAQ' },
];

const FEATURES = [
  { icon: Globe, title: 'Live web search', text: 'Current answers grounded in Tavily, Brave or Serper results with per-answer citations.' },
  { icon: FileText, title: 'Document Q&A (RAG)', text: 'Upload PDF, DOCX, Markdown, CSV or JSON — chunked, embedded and retrieved for precise answers.' },
  { icon: Microscope, title: 'Deep research mode', text: 'A bounded research agent that decomposes questions, searches many sources and compares them.' },
  { icon: Zap, title: 'Smart model routing', text: 'Fast models for simple questions, stronger models for reasoning, coding and long contexts.' },
  { icon: MessagesSquare, title: 'Memory that behaves', text: 'Conversation summaries, windowing, folders, search, rename and export — no unbounded context.' },
  { icon: Lock, title: 'Secure by design', text: 'Auth, rate limiting, input validation and server-side secrets. Keys never reach the browser.' },
];

const STEPS = [
  { n: '1', title: 'Understand', text: 'Intent detection decides what kind of answer you need.' },
  { n: '2', title: 'Retrieve', text: 'Web search, open knowledge connectors, or your documents.' },
  { n: '3', title: 'Rank', text: 'Deduplication, relevance scoring and context compression.' },
  { n: '4', title: 'Generate', text: 'A routed model streams a structured, cited answer.' },
  { n: '5', title: 'Verify', text: 'Optional claim checking against the retrieved evidence.' },
];

const FAQ = [
  {
    q: 'What is NovaAI?',
    a: 'NovaAI is a full-stack AI answer engine: a chat assistant, a search interface and a private knowledge base in one. It decides per question whether to answer from model knowledge, live web search, open knowledge sources or your uploaded documents.',
  },
  {
    q: 'Which AI providers are supported?',
    a: 'OpenAI, Anthropic Claude and Google Gemini, plus any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, OpenRouter) through OPENAI_BASE_URL. A clearly-labelled mock provider lets you run in demo mode before any key exists.',
  },
  {
    q: 'Which search and knowledge sources does it use?',
    a: 'Web search via Tavily, Brave or Serper with graceful fallback. Keyless knowledge connectors include Wikipedia, Wikidata, arXiv, Crossref, OpenAlex, PubMed, Open Library and Project Gutenberg — all official public APIs.',
  },
  {
    q: 'Can I ask questions about my own files?',
    a: 'Yes. Upload PDF, DOCX, TXT, Markdown, CSV or JSON files; NovaAI extracts the text, chunks it, embeds it into a vector store and retrieves the most relevant passages (RAG) when you ask about them.',
  },
  {
    q: 'Is my data private?',
    a: 'Conversations and files are stored in your own database and only visible to you. API keys and database credentials stay on the server. Analytics record counts, latency and token usage — not message content.',
  },
];

function Reveal ({ children, delay = 0, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function Landing () {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setMobileOpen(false);
    NAV.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) el.style.scrollMarginTop = '80px';
    });
    void handler;
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-surface-dark">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-surface-dark/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Logo size="md" to="/" />
          <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Primary">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollTo(item.id)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link to="/login" className="btn-ghost hidden sm:inline-flex">Sign in</Link>
            <Link to="/register" className="btn-primary">Get started</Link>
            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 lg:hidden"
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-surface-dark-2 lg:hidden">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollTo(item.id)}
                className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
              >
                {item.label}
              </button>
            ))}
            <Link to="/login" className="mt-1 block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5">
              Sign in
            </Link>
          </div>
        ) : null}
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40">
          <div className="pointer-events-none absolute left-1/2 top-10 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-500/25 via-violet-500/20 to-fuchsia-500/20 blur-3xl" aria-hidden="true" />

          <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
                <Sparkles size={13} />
                AI Answer Engine · Search + RAG + Deep Research
              </span>
            </Reveal>

            <Reveal delay={0.08}>
              <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl dark:text-white">
                Ask Anything.
                <span className="block bg-gradient-to-r from-brand-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
                  Understand Everything.
                </span>
              </h1>
            </Reveal>

            <Reveal delay={0.16}>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-500 sm:text-lg dark:text-slate-400">
                An intelligent AI assistant that searches, understands, and explains information in one place.
              </p>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link to="/chat" className="btn-primary !px-6 !py-3 text-base">
                  Start Chatting <ArrowRight size={17} />
                </Link>
                <button type="button" onClick={() => scrollTo('features')} className="btn-outline !px-6 !py-3 text-base">
                  Explore Features
                </button>
              </div>
            </Reveal>

            <Reveal delay={0.34}>
              <div className="card mx-auto mt-14 max-w-3xl p-5 text-left shadow-card">
                <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500 dark:bg-white/5 dark:text-slate-400">
                  <Search size={15} />
                  What is quantum computing?
                  <span className="ml-auto rounded-full bg-brand-500 px-3 py-1 text-[11px] font-semibold text-white">Ask</span>
                </div>
                <div className="mt-4 space-y-2.5" aria-hidden="true">
                  <div className="skeleton h-3 w-11/12" />
                  <div className="skeleton h-3 w-10/12" />
                  <div className="skeleton h-3 w-8/12" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['Wikipedia', 'arXiv', 'Nature'].map((chip) => (
                    <span key={chip} className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-400 dark:border-white/10 dark:text-slate-500">
                      {chip}
                    </span>
                  ))}
                  <span className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-[11px] font-medium text-slate-400 dark:border-white/20">
                    Preview
                  </span>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              Everything an answer engine should be
            </h2>
            <p className="mt-4 text-slate-500 dark:text-slate-400">
              Retrieval, routing and verification are first-class — not afterthoughts.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <Reveal key={feature.title} delay={index * 0.05}>
                <div className="card h-full p-6 transition hover:-translate-y-1 hover:shadow-card">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-violet-600 text-white shadow-glow">
                    <feature.icon size={19} />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{feature.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-y border-slate-200/70 bg-white/60 py-20 dark:border-white/10 dark:bg-white/[0.02]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">How it works</h2>
              <p className="mt-4 text-slate-500 dark:text-slate-400">
                Every question runs through the same disciplined pipeline.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {STEPS.map((step, index) => (
                <Reveal key={step.n} delay={index * 0.06}>
                  <div className="relative h-full rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-surface-dark-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/10 text-sm font-bold text-brand-600 dark:text-brand-300">
                      {step.n}
                    </span>
                    <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">{step.title}</h3>
                    <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{step.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Research */}
        <section id="research" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-600 dark:text-violet-300">
                <Microscope size={13} /> Research
              </span>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
                Deep research, with boundaries
              </h2>
              <p className="mt-4 leading-7 text-slate-500 dark:text-slate-400">
                NovaAI breaks a question into subquestions, searches several sources, deduplicates and ranks
                them, then synthesizes a structured report — always within configurable limits.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Splits questions into focused subqueries',
                  'Searches web + open knowledge connectors in parallel',
                  'Deduplicates and ranks by relevance and authority',
                  'Flags contradictions instead of hiding them',
                  'Cites only sources that were actually retrieved',
                  'Communicates uncertainty rather than inventing facts',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                    <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="card p-6 shadow-card">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <Quote size={13} /> Research progress
                </div>
                <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                  “Explain the current state of solid-state batteries.”
                </p>
                <ul className="mt-4 space-y-3">
                  {[
                    { label: 'Decomposing question', state: 'done' },
                    { label: 'Searching 4 subqueries', state: 'done' },
                    { label: 'Consulting arXiv, Crossref, Wikipedia', state: 'done' },
                    { label: 'Comparing 12 sources', state: 'done' },
                    { label: 'Synthesizing report', state: 'active' },
                  ].map((row) => (
                    <li key={row.label} className="flex items-center gap-3 text-sm">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                        row.state === 'done'
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : 'bg-brand-500/15 text-brand-500 animate-pulseSoft'
                      }`}>
                        {row.state === 'done' ? '✓' : '·'}
                      </span>
                      <span className={row.state === 'done' ? 'text-slate-500 dark:text-slate-400' : 'font-medium text-slate-700 dark:text-slate-200'}>
                        {row.label}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-400 dark:bg-white/5 dark:text-slate-500">
                  Budgets enforced: max 6 searches · max 12 sources · 90s time limit
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="border-y border-slate-200/70 bg-white/60 py-20 dark:border-white/10 dark:bg-white/[0.02]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">Security first</h2>
              <p className="mt-4 text-slate-500 dark:text-slate-400">
                A serious product deserves serious defaults.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {[
                { icon: Shield, title: 'Server-side secrets', text: 'AI, search and database credentials live only in the server environment — never in the browser bundle.' },
                { icon: Zap, title: 'Rate limiting & validation', text: 'Global, auth and chat rate limits with zod validation on every request body, query and param.' },
                { icon: Database, title: 'Private by default', text: 'HttpOnly sessions, origin checks, hashed password storage and usage analytics without message content.' },
              ].map((item, index) => (
                <Reveal key={item.title} delay={index * 0.06}>
                  <div className="card h-full p-6">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      <item.icon size={19} />
                    </span>
                    <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal>
              <p className="mx-auto mt-8 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-center text-xs leading-6 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                Demo mode is clearly labelled: when no API key is configured, NovaAI says so instead of
                pretending mock text is real-world information.
              </p>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <Reveal className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">FAQ</h2>
          </Reveal>

          <div className="mt-10 space-y-3">
            {FAQ.map((item, index) => (
              <Reveal key={item.q} delay={index * 0.04}>
                <details className="group card overflow-hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-slate-800 marker:hidden dark:text-slate-100">
                    {item.q}
                    <ChevronDown size={16} className="shrink-0 text-slate-400 transition group-open:rotate-180" />
                  </summary>
                  <p className="border-t border-slate-100 px-5 py-4 text-sm leading-6 text-slate-500 dark:border-white/5 dark:text-slate-400">
                    {item.a}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-violet-700 px-6 py-14 text-center shadow-glow">
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
              <Brain className="mx-auto text-white/80" size={30} />
              <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">Ready to ask?</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/80">
                Start chatting in seconds — configure your own AI and search providers when you are ready to go live.
              </p>
              <Link to="/register" className="btn mt-7 bg-white !px-6 !py-3 text-base font-bold text-brand-700 hover:bg-white/90">
                Get started free <ArrowRight size={17} />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-slate-200/70 bg-white/60 py-10 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 sm:px-6 md:flex-row md:justify-between">
          <div className="text-center md:text-left">
            <Logo size="sm" to="/" />
            <p className="mt-2 max-w-sm text-xs leading-5 text-slate-400">
              NovaAI — an open-architecture AI answer engine with web search, RAG and deep research.
            </p>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500" aria-label="Footer">
            {NAV.map((item) => (
              <button key={item.id} type="button" onClick={() => scrollTo(item.id)} className="hover:text-brand-600 dark:hover:text-brand-300">
                {item.label}
              </button>
            ))}
            <Link to="/login" className="hover:text-brand-600 dark:hover:text-brand-300">Sign in</Link>
          </nav>
        </div>
        <p className="mt-8 text-center text-[11px] text-slate-400">
          © {new Date().getFullYear()} NovaAI. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
