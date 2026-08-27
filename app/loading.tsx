// Root-level loading skeleton shown while the landing page compiles
export default function RootLoading() {
  return (
    <div className="min-h-screen bg-navy-900 flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 rounded-lg bg-indigo-600/50 animate-pulse" />
      <div className="space-y-2 text-center">
        <div className="h-3 w-32 bg-surface-600 rounded animate-pulse mx-auto" />
        <div className="h-2 w-20 bg-surface-700 rounded animate-pulse mx-auto" />
      </div>
    </div>
  );
}
