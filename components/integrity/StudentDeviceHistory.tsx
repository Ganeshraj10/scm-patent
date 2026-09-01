'use client';

import React from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DeviceUsageStat } from '@/lib/services/studentHistoryService';
import { Monitor, Laptop, Smartphone, CheckCircle2 } from 'lucide-react';

interface StudentDeviceHistoryProps {
  devices: DeviceUsageStat[];
}

export function StudentDeviceHistory({ devices }: StudentDeviceHistoryProps) {
  if (!devices || devices.length === 0) {
    return (
      <Card padding="md">
        <p className="text-center text-text-muted text-xs">
          No device history recorded yet.
        </p>
      </Card>
    );
  }

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone size={16} className="text-emerald-400" />;
      case 'web_laptop':
        return <Laptop size={16} className="text-sky-400" />;
      case 'web_desktop':
      default:
        return <Monitor size={16} className="text-indigo-400" />;
    }
  };

  return (
    <Card>
      <CardHeader
        title="Device History"
        subtitle="Hardware environments used across your coursework history"
        badge={<Badge variant="active">{devices.length} Devices</Badge>}
      />
      <div className="space-y-3 mt-3">
        {devices.map((d) => (
          <div
            key={d.deviceType}
            className="p-3 rounded-xl bg-surface-700/30 border border-border space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-surface-800 border border-border">
                  {getDeviceIcon(d.deviceType)}
                </div>
                <div>
                  <span className="text-xs font-bold text-text-primary block">
                    {d.displayLabel}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {d.sessionCount} sessions · {d.questionCount} questions answered
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-indigo-300 font-mono">
                  {d.percentage}%
                </span>
                <span className="text-[10px] text-text-muted block">
                  Last: {d.lastUsedDate.split(' ')[0]}
                </span>
              </div>
            </div>

            {/* Usage progress bar */}
            <div className="w-full bg-surface-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${d.percentage}%` }}
              />
            </div>
          </div>
        ))}

        <div className="p-2.5 rounded-lg bg-surface-700/20 border border-border/60 text-[10px] text-text-muted leading-relaxed">
          Device context is preserved historically as part of your natural coursework environment.
        </div>
      </div>
    </Card>
  );
}
