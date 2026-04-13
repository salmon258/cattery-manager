'use client';

import { useState } from 'react';
import { Download, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface DateRange { from: string; to: string }

interface Props {
  title: string;
  description?: string;
  /** Default date range (YYYY-MM-DD). Defaults to last 30 days. */
  defaultRange?: DateRange;
  onRangeChange?: (range: DateRange) => void;
  onExport?: () => void;
  exportDisabled?: boolean;
  rightToolbar?: React.ReactNode;
  children: React.ReactNode;
}

function defaultRangeForLastNDays(n = 30): DateRange {
  const to   = new Date();
  const from = new Date();
  from.setDate(from.getDate() - n);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function ReportShell({
  title, description, defaultRange, onRangeChange, onExport, exportDisabled, rightToolbar, children
}: Props) {
  const initial = defaultRange ?? defaultRangeForLastNDays();
  const [range, setRange] = useState<DateRange>(initial);

  function update(patch: Partial<DateRange>) {
    const next = { ...range, ...patch };
    setRange(next);
    onRangeChange?.(next);
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {rightToolbar}
            {onExport && (
              <Button size="sm" variant="outline" onClick={onExport} disabled={exportDisabled}>
                <Download className="h-4 w-4" /> CSV
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <Label htmlFor="rs-from" className="text-xs">From</Label>
          </div>
          <Input
            id="rs-from"
            type="date"
            value={range.from}
            onChange={(e) => update({ from: e.target.value })}
            className="h-8 w-40 text-xs"
          />
          <Label htmlFor="rs-to" className="text-xs text-muted-foreground">To</Label>
          <Input
            id="rs-to"
            type="date"
            value={range.to}
            onChange={(e) => update({ to: e.target.value })}
            className="h-8 w-40 text-xs"
          />
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
