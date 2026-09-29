/**
 * Markdown answer renderer: GFM tables, math (KaTeX), syntax highlighting,
 * custom code blocks with copy buttons and collapsible long sections.
 */
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { Copy, Check } from 'lucide-react';

function CodeBlock ({ className, children, ...props }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : 'text';
  const code = String(children || '').replace(/\n$/, '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="code-block group">
      <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:border-white/10 dark:text-slate-500">
        <span>{language}</span>
        <button type="button" onClick={copy} className="copy-btn !opacity-0 group-hover:!opacity-100 focus:!opacity-100" aria-label="Copy code">
          {copied ? <Check size={12} className="inline" /> : <Copy size={12} className="inline" />}
          <span className="ml-1">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="!mt-0 !rounded-none border-0">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

export default function Answer ({ content, className = '' }) {
  if (!content) return null;
  return (
    <div className={`answer-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          code: ({ className: cls, children: raw, ...props }) => {
            const isBlock = /language-/.test(cls || '') || String(raw || '').includes('\n');
            if (isBlock) return <CodeBlock className={cls} {...props}>{raw}</CodeBlock>;
            return <code className={cls} {...props}>{raw}</code>;
          },
          pre: ({ children }) => children,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
