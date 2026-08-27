// Instructor area loading skeleton — shows immediately while the route compiles.
// This replaces the blank screen / frozen UI during first-visit Turbopack compilation.
export default function InstructorLoading() {
  return (
    <div className="flex-1 p-5 lg:p-6 space-y-5 animate-pulse">
      {/* Page title skeleton */}
      <div className="space-y-2">
        <div className="h-5 w-48 bg-surface-700 rounded" />
        <div className="h-3 w-72 bg-surface-800 rounded" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl bg-surface-800 border border-border p-5 space-y-3">
            <div className="flex justify-between">
              <div className="space-y-2">
                <div className="h-2.5 w-20 bg-surface-700 rounded" />
                <div className="h-7 w-16 bg-surface-600 rounded" />
                <div className="h-2 w-28 bg-surface-700 rounded" />
              </div>
              <div className="w-9 h-9 rounded-lg bg-surface-700" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl bg-surface-800 border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <div className="h-4 w-56 bg-surface-700 rounded" />
            <div className="h-2.5 w-40 bg-surface-800 rounded mt-1.5" />
          </div>
          <div className="p-5 h-64 flex items-end gap-3 justify-center">
            {[40, 65, 50, 80, 45, 70, 55, 30].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-surface-700 rounded-t"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-surface-800 border border-border p-5 space-y-4">
          <div className="h-4 w-32 bg-surface-700 rounded" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-surface-600" />
              <div className="h-3 flex-1 bg-surface-700 rounded" />
              <div className="h-3 w-8 bg-surface-600 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl bg-surface-800 border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="h-4 w-40 bg-surface-700 rounded" />
        </div>
        <div className="divide-y divide-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-5 py-3.5 flex items-center gap-4">
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-36 bg-surface-700 rounded" />
                <div className="h-2.5 w-24 bg-surface-800 rounded" />
              </div>
              <div className="h-5 w-16 bg-surface-700 rounded-full" />
              <div className="h-5 w-12 bg-surface-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
