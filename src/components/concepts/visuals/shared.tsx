/** Frame shared by every interactive concept visual. */
export function VisualFrame({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="border-brand overflow-hidden rounded-2xl shadow-soft">
      <figcaption className="border-b border-line px-4 py-3">
        <p className="font-semibold text-fg">{title}</p>
        <p className="text-sm text-muted">{hint}</p>
      </figcaption>
      <div className="p-4">{children}</div>
    </figure>
  );
}

export function VisualButton({
  onClick,
  children,
  primary = false,
  disabled = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${
        primary ? "bg-accent text-[#fff] hover:opacity-90" : "border border-line text-fg-soft hover:border-line-strong hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

/** Small, deterministic 32-bit FNV-1a hash so visuals render the same on server and client. */
export function fnv1a(text: string, seed = 0x811c9dc5): number {
  let hash = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  // Murmur3 finaliser: spreads similar inputs ("user:1", "user:2") across the range.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

export const palette = ["#6366f1", "#f59e0b", "#10b981", "#ec4899", "#0ea5e9"];
