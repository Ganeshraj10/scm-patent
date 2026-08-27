export default function StudentLoading() {
  return (
    <div className="space-y-5 animate-pulse max-w-4xl">
      <div className="space-y-2">
        <div className="h-5 w-40 bg-surface-700 rounded" />
        <div className="h-3 w-60 bg-surface-800 rounded" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl bg-surface-800 border border-border p-5 space-y-3">
            <div className="h-2.5 w-20 bg-surface-700 rounded" />
            <div className="h-7 w-14 bg-surface-600 rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-surface-800 border border-border p-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-3 bg-surface-700 rounded w-full" />
        ))}
      </div>
    </div>
  );
}
