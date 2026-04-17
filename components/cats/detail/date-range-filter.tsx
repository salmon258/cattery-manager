'use client';

import { Calendar } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export interface DateRange {
  from: string;
  to: string;
}

export function startOfDayIso(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

export function endOfDayIso(d: Date): string {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.toISOString();
}

export function defaultLastNDays(n: number): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - n + 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10)
  };
}

interface Props {
  value: DateRange;
  onChange: (r: DateRange) => void;
  presets?: { label: string; days: number }[];
}

export function DateRangeFilter({ value, onChange, presets }: Props) {
  const tc = useTranslations('common');
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        <Label htmlFor="dr-from" className="text-xs">
          {tc('from')}
        </Label>
      </div>
      <Input
        id="dr-from"
        type="date"
        value={value.from}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
        className="h-8 w-40 text-xs"
        max={value.to}
      />
      <Label htmlFor="dr-to" className="text-xs text-muted-foreground">
        {tc('to')}
      </Label>
      <Input
        id="dr-to"
        type="date"
        value={value.to}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        className="h-8 w-40 text-xs"
        min={value.from}
      />
      {presets && presets.length > 0 && (
        <div className="flex gap-1 ml-1">
          {presets.map((p) => (
            <Button
              key={p.days}
              size="sm"
              variant="ghost"
              type="button"
              className="h-7 text-xs px-2"
              onClick={() => onChange(defaultLastNDays(p.days))}
            >
              {p.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
