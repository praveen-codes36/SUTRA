import React from 'react';

export interface ProgressBarProps {
  value: number;
  max?: number;
  label: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  className = '',
}) => {
  const clamped = Math.max(0, Math.min(max, value));
  const pct = max > 0 ? Math.round((clamped / max) * 100) : 0;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between text-[12px] text-[#202B35]">
        <span>{label}</span>
        <span className="tabular-nums font-medium">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clamped}
        className="h-2 w-full overflow-hidden rounded-[4px] bg-[#E5E2D9]"
      >
        <div
          className="h-full bg-[#102D2A] transition-[width] duration-150"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
