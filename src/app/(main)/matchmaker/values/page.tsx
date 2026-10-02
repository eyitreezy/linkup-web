import { MatchMakerValuesScreen } from '@/features/matchmaker/MatchMakerValuesScreen';
import { Suspense } from 'react';

export const metadata = { title: 'MatchMaker — Values' };

export default function MatchMakerValuesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-10">
          <div className="h-64 animate-pulse rounded-2xl bg-[#FBF5F0]" />
        </div>
      }
    >
      <MatchMakerValuesScreen />
    </Suspense>
  );
}
