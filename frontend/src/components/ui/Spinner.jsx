export default function Spinner ({ size = 'md', label = '' }) {
  const sizes = { sm: 'h-4 w-4 border-2', md: 'h-5 w-5 border-2', lg: 'h-8 w-8 border-[3px]' };
  return (
    <span className="inline-flex items-center gap-3" role="status" aria-live="polite">
      <span
        className={`${sizes[size] || sizes.md} animate-spin rounded-full border-brand-500 border-t-transparent`}
        aria-hidden="true"
      />
      {label ? <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span> : null}
    </span>
  );
}
