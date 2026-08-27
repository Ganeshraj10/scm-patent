import { InstructorLayoutClient } from '@/components/layout/InstructorLayoutClient';

export default function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InstructorLayoutClient title="Instructor Portal">
      {children}
    </InstructorLayoutClient>
  );
}
