'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Check, ChevronDown, Search, User } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type AssigneeOption = {
  id: string;
  full_name: string;
  assigned_cats_count?: number;
};

async function fetchAssignees(): Promise<AssigneeOption[]> {
  // Hits the admin /api/users endpoint — only admin callers actually need
  // this dropdown (assignee change + reassign-on-deactivate). Filters to
  // active cat_sitters.
  const r = await fetch('/api/users', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  const { users } = (await r.json()) as {
    users: {
      id: string;
      full_name: string;
      role: 'admin' | 'cat_sitter';
      is_active: boolean;
      assigned_cats_count: number;
    }[];
  };
  return users
    .filter((u) => u.role === 'cat_sitter' && u.is_active)
    .map((u) => ({ id: u.id, full_name: u.full_name, assigned_cats_count: u.assigned_cats_count }));
}

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  /** uuid to exclude from the list (e.g. the sitter being deactivated) */
  excludeId?: string | null;
  allowUnassigned?: boolean;
  placeholder?: string;
}

/**
 * Minimal searchable dropdown of active Cat Sitters. Built without Popover to
 * avoid yet another primitive; uses a plain open/close state.
 */
export function AssigneeSelect({
  value,
  onChange,
  excludeId,
  allowUnassigned = true,
  placeholder
}: Props) {
  const t = useTranslations('assignees');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const { data = [], isLoading } = useQuery({
    queryKey: ['assignees'],
    queryFn: fetchAssignees
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data
      .filter((u) => !excludeId || u.id !== excludeId)
      .filter((u) => !needle || u.full_name.toLowerCase().includes(needle));
  }, [data, q, excludeId]);

  const selected = data.find((u) => u.id === value) ?? null;

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={cn('truncate', !selected && !value && 'text-muted-foreground')}>
          {selected ? selected.full_name : value === null ? t('unassigned') : placeholder ?? t('selectAssignee')}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
            <div className="relative border-b p-2">
              <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tc('search')}
                className="h-8 pl-8"
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {allowUnassigned && (
                <Option
                  active={value === null}
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <span className="text-muted-foreground">{t('unassigned')}</span>
                </Option>
              )}
              {isLoading && (
                <div className="px-3 py-2 text-xs text-muted-foreground">{tc('loading')}</div>
              )}
              {!isLoading && filtered.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">{tc('empty')}</div>
              )}
              {filtered.map((u) => (
                <Option
                  key={u.id}
                  active={value === u.id}
                  onClick={() => {
                    onChange(u.id);
                    setOpen(false);
                  }}
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{u.full_name}</span>
                  {typeof u.assigned_cats_count === 'number' && (
                    <span className="text-xs text-muted-foreground">
                      {u.assigned_cats_count}
                    </span>
                  )}
                </Option>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Option({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent',
        active && 'bg-accent'
      )}
    >
      {active ? <Check className="h-3.5 w-3.5 text-primary" /> : <span className="inline-block w-3.5" />}
      {children}
    </button>
  );
}
