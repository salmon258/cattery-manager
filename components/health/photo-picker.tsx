'use client';

import { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  /** Max number of photos allowed (default 10) */
  max?: number;
  disabled?: boolean;
}

export function PhotoPicker({ files, onChange, max = 10, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;
    const next = [...files, ...selected].slice(0, max);
    onChange(next);
    // Reset input so the same file can be re-selected after removal
    e.target.value = '';
  }

  function remove(index: number) {
    const next = files.filter((_, i) => i !== index);
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {/* Thumbnails */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, i) => (
            <div key={i} className="relative h-16 w-16 rounded-md overflow-hidden border bg-muted group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="h-full w-full object-cover"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  aria-label="Remove photo"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add button */}
      {files.length < max && !disabled && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleSelect}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Add photos{files.length > 0 ? ` (${files.length}/${max})` : ''}
          </Button>
        </>
      )}
    </div>
  );
}
