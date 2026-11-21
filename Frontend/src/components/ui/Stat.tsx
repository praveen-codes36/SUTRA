import React from 'react';

export interface StatProps {
  label: string;
  value: string | number;
  sourceLabel: string;
  footnote?: string;
  className?: string;
}

export const Stat: React.FC<StatProps> = ({
  label,
  value,
  sourceLabel,
  footnote,
  className = '',
}) => {
  return (
    <div
      className={`min-w-0 flex flex-col justify-start border-t-2 border-[#102D2A] bg-white px-4 py-3.5 border-x border-b border-x-[#E5E2D9] border-b-[#E5E2D9] ${className}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <span className="font-display text-[13px] font-medium text-[#5A6560]">{label}</span>
        <span className="text-[11px] font-medium text-[#7A5C1E]">
          {sourceLabel}
        </span>
      </div>
      <div className="mt-2 font-display text-[24px] font-bold tracking-tight text-[#102D2A] tabular-nums">
        {value}
      </div>
      {footnote && (
        <p className="mt-1.5 text-[12px] text-[#5A6560] leading-snug">{footnote}</p>
      )}
    </div>
  );
};
