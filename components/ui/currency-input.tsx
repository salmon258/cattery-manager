'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';

interface Props extends Omit<React.ComponentPropsWithoutRef<typeof Input>, 'value' | 'onChange' | 'type'> {
  /** Raw numeric value as a string of digits (no separators). Empty string = unset. */
  value: string;
  onChange: (rawDigits: string) => void;
  /** Thousands separator. Defaults to "," (en-US). Pass "." for id-ID. */
  separator?: string;
}

function formatDigits(digits: string, separator: string): string {
  if (!digits) return '';
  // Strip leading zeros so "0001000" → "1000"
  const trimmed = digits.replace(/^0+(?=\d)/, '');
  return trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/**
 * Numeric input that displays its value with thousands separators while
 * keeping the underlying state as a raw digit string. Use it for amounts
 * (visit cost, salary, etc.) where the user wants to see "1,250,000".
 *
 * The parent is in charge of converting the raw digit string to a Number
 * before submitting (just `Number(value)`).
 */
export const CurrencyInput = React.forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, separator = ',', inputMode, ...rest }, ref) => {
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const digits = e.target.value.replace(/[^\d]/g, '');
      onChange(digits);
    }
    return (
      <Input
        ref={ref}
        type="text"
        inputMode={inputMode ?? 'numeric'}
        value={formatDigits(value, separator)}
        onChange={handleChange}
        {...rest}
      />
    );
  }
);
CurrencyInput.displayName = 'CurrencyInput';
