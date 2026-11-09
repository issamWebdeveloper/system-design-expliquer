/** A small "disconnected nodes" drawing for empty states and the 404 page. */
export default function EmptyIllustration({ className = "h-24 w-40" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 96" className={className} aria-hidden>
      <defs>
        <linearGradient id="empty-brand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="0.55" stopColor="var(--accent-2)" />
          <stop offset="1" stopColor="var(--accent-3)" />
        </linearGradient>
      </defs>
      <path d="M44 48 H70" stroke="var(--line-strong)" strokeWidth="3" strokeLinecap="round" />
      <path d="M90 48 H116" stroke="var(--line-strong)" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 7" />
      <rect x="8" y="30" width="36" height="36" rx="10" fill="var(--surface)" stroke="url(#empty-brand)" strokeWidth="3" />
      <rect x="116" y="30" width="36" height="36" rx="10" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="3" />
      <circle cx="80" cy="48" r="10" fill="none" stroke="url(#empty-brand)" strokeWidth="3" />
      <path d="M76 44 L84 52 M84 44 L76 52" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
