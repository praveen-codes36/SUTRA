import React from 'react';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex items-center rounded-[4px] border border-[#7B8581] bg-[#F5F2EA] p-0.5 ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`min-h-[44px] lg:min-h-0 rounded-[3px] font-display font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-150 ${
              size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3 py-1.5 text-[13px]'
            } ${
              active
                ? 'bg-[#102D2A] text-[#F5F2EA]'
                : 'text-[#202B35] hover:bg-[#E8EFEA]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
