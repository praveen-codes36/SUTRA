import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  className = '',
}) => {
  const id = useId();
  const listboxId = `${id}-listbox`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    Math.max(0, options.findIndex((o) => o.value === value)),
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const idx = options.findIndex((o) => o.value === value);
        setActiveIndex(idx >= 0 ? idx : 0);
        setOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % Math.max(1, options.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + options.length) % Math.max(1, options.length));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(Math.max(0, options.length - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const opt = options[activeIndex];
      if (opt) {
        onChange(opt.value);
      }
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  return (
    <div ref={containerRef} className={`relative flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-[#202B35] font-display">
          {label}
        </label>
      )}
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => {
          if (disabled) return;
          const idx = options.findIndex((o) => o.value === value);
          setActiveIndex(idx >= 0 ? idx : 0);
          setOpen((prev) => !prev);
        }}
        onKeyDown={handleKeyDown}
        className="flex min-h-[44px] lg:min-h-[40px] w-full items-center justify-between gap-2 rounded-[4px] border border-[#7B8581] bg-white px-3 py-2 text-left text-[14px] text-[#202B35] hover:border-[#102D2A] disabled:bg-[#F5F2EA] disabled:opacity-60 cursor-pointer"
      >
        <span className={`truncate ${selected ? 'text-[#202B35]' : 'text-[#5A6560]'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className="shrink-0 text-[#5A6560]" aria-hidden="true" />
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-activedescendant={options[activeIndex] ? `${id}-opt-${activeIndex}` : undefined}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          className="absolute left-0 top-full z-40 mt-1 max-h-64 w-full min-w-[180px] overflow-auto rounded-[4px] border border-[#7B8581] bg-white py-1 shadow-[var(--shadow-overlay)]"
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isActive = idx === activeIndex;
            return (
              <li
                key={opt.value}
                id={`${id}-opt-${idx}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
                className={`flex min-h-[44px] lg:min-h-0 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-[13px] ${
                  isActive ? 'bg-[#E8EFEA] text-[#102D2A]' : 'text-[#202B35]'
                }`}
              >
                <span className="flex flex-col">
                  <span className={isSelected ? 'font-semibold text-[#102D2A]' : ''}>
                    {opt.label}
                  </span>
                  {opt.description && (
                    <span className="text-[12px] text-[#5A6560]">{opt.description}</span>
                  )}
                </span>
                {isSelected && <Check size={14} className="mt-0.5 shrink-0 text-[#102D2A]" aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
