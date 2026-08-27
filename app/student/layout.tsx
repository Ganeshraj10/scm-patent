import { StudentLayoutClient } from '@/components/layout/StudentLayoutClient';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <StudentLayoutClient title="Student Portal">
      {children}
    </StudentLayoutClient>
  );
}
