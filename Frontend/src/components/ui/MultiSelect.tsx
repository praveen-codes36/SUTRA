import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  label?: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  className?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  label,
  values,
  onChange,
  options,
  placeholder = 'All selected',
  className = '',
}) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const toggle = (val: string) => {
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  const summary =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? options.find((o) => o.value === values[0])?.label || values[0]
        : `${values.length} selected`;

  return (
    <div ref={containerRef} className={`relative flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-[#202B35] font-display">
          {label}
        </label>
      )}
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((p) => !p)}
        className="flex min-h-[44px] lg:min-h-[40px] w-full items-center justify-between gap-2 rounded-[4px] border border-[#7B8581] bg-white px-3 py-2 text-left text-[14px] text-[#202B35] hover:border-[#102D2A] cursor-pointer"
      >
        <span className="truncate">{summary}</span>
        <ChevronDown size={16} className="shrink-0 text-[#5A6560]" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 top-full z-40 mt-1 max-h-64 w-full min-w-[200px] overflow-auto rounded-[4px] border border-[#7B8581] bg-white py-1 shadow-[var(--shadow-overlay)]"
        >
          {values.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full min-h-[44px] lg:min-h-0 border-b border-[#E5E2D9] px-3 py-1.5 text-left text-[12px] font-medium text-[#7A5C1E] hover:bg-[#F5F2EA]"
            >
              Clear selection
            </button>
          )}
          {options.map((opt) => {
            const checked = values.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => toggle(opt.value)}
                className={`flex w-full min-h-[44px] lg:min-h-0 items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-[#E8EFEA] ${
                  checked ? 'bg-[#E8EFEA]/60 font-medium text-[#102D2A]' : 'text-[#202B35]'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {checked && <Check size={14} className="shrink-0 text-[#102D2A]" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
