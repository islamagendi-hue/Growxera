/** Shown while a studio page loads its data. */
export default function StudioLoading() {
  return (
    <div className="mt-8" role="status" aria-live="polite">
      <p className="sr-only">Loading…</p>
      <div className="h-10 w-48 animate-pulse bg-paper-2" />
      <div className="mt-6 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse bg-card" />
        ))}
      </div>
      <div className="mt-8 h-64 animate-pulse border border-line bg-card" />
    </div>
  );
}
