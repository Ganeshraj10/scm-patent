import React from 'react';
import { AdminLayoutClient } from '@/components/layout/AdminLayoutClient';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminLayoutClient title="Platform Administration">
      {children}
    </AdminLayoutClient>
  );
}
