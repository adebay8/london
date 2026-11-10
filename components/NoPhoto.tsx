// Not every retailer publishes a photo. The gap should look deliberate, not
// broken: a soft tile, a thin picture outline and a quiet label.
export default function NoPhoto({ label = "No photo published" }: { label?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[var(--sunk)] text-[var(--ink-3)]"
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="1.75" />
        <path d="m21 16-5-5-8 8" strokeLinejoin="round" />
      </svg>
      <span className="text-xs">No photo</span>
    </div>
  );
}
