export default function CreatePlanLoading() {
  return (
    <div className="animate-pulse space-y-8 pb-10" aria-busy="true" aria-label="Loading create plan">
      <div className="flex items-center gap-4">
        <div className="h-11 w-11 rounded-2xl bg-[#EDE8FF]/80" />
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-[#EDE8FF]/70" />
          <div className="h-8 w-40 rounded bg-[#EDE8FF]/80" />
        </div>
      </div>
      <div className="h-48 rounded-2xl bg-[#EDE8FF]/60" />
      <div className="h-64 rounded-2xl bg-[#EDE8FF]/50" />
    </div>
  );
}
