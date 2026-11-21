import React, { useId } from 'react';

export interface DateRangeProps {
  label?: string;
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  stacked?: boolean;
  className?: string;
}

export const DateRange: React.FC<DateRangeProps> = ({
  label = 'Date range',
  from,
  to,
  onChange,
  stacked = false,
  className = '',
}) => {
  const id = useId();

  return (
    <fieldset className={`flex flex-col gap-1.5 ${className}`}>
      <legend className="text-[13px] font-medium text-[#202B35] font-display mb-1">
        {label}
      </legend>
      <div className={`grid gap-2 ${stacked ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-from`} className="text-[12px] text-[#5A6560]">
            From
          </label>
          <input
            id={`${id}-from`}
            type="date"
            value={from}
            onChange={(e) => onChange({ from: e.target.value, to })}
            className="min-h-[44px] lg:min-h-[38px] w-full rounded-[4px] border border-[#7B8581] bg-white px-2.5 py-1.5 text-[13px] text-[#202B35] tabular-nums focus:border-[#102D2A]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-to`} className="text-[12px] text-[#5A6560]">
            To
          </label>
          <input
            id={`${id}-to`}
            type="date"
            value={to}
            onChange={(e) => onChange({ from, to: e.target.value })}
            className="min-h-[44px] lg:min-h-[38px] w-full rounded-[4px] border border-[#7B8581] bg-white px-2.5 py-1.5 text-[13px] text-[#202B35] tabular-nums focus:border-[#102D2A]"
          />
        </div>
      </div>
    </fieldset>
  );
};
