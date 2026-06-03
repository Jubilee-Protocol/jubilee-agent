'use client';

import { TriuneLayout } from '@/components/dashboard/TriuneLayout';
import { MindPanel } from '@/components/dashboard/MindPanel';
import { ProphetPanel } from '@/components/dashboard/ProphetPanel';
import { WillPanel } from '@/components/dashboard/WillPanel';

export default function Home() {
  return (
    <TriuneLayout>
      <MindPanel />
      <ProphetPanel />
      <WillPanel />
    </TriuneLayout>
  );
}
