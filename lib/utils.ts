import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | null | undefined, locale = 'en') {
  if (!iso) return '—';
  const d = new Date(iso);
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  }).format(d);
}

export function formatAge(
  dob: string | null | undefined,
  labels: { years: string; months: string; days: string }
): string {
  if (!dob) return '—';
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return '—';
  const now = new Date();

  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return '—';

  if (years >= 1) {
    return months > 0
      ? `${years} ${labels.years} ${months} ${labels.months}`
      : `${years} ${labels.years}`;
  }
  if (months >= 1) {
    return `${months} ${labels.months}`;
  }
  return `${days} ${labels.days}`;
}
