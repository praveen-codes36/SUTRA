import React from 'react';

export interface TimelineEntry {
  id: string;
  timestampLabel: string;
  title: string;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  highlighted?: boolean;
}

export interface TimelineProps {
  entries: TimelineEntry[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ entries, className = '' }) => {
  return (
    <ol className={`relative border-l border-[#7B8581]/50 pl-5 space-y-5 ${className}`}>
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span
            aria-hidden="true"
            className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 ${
              entry.highlighted
                ? 'border-[#102D2A] bg-[#D5B77B]'
                : 'border-[#102D2A] bg-[#F5F2EA]'
            }`}
          />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-display text-[13px] font-semibold text-[#102D2A]">
              {entry.title}
            </span>
            <span className="text-[12px] text-[#5A6560] tabular-nums">
              {entry.timestampLabel}
            </span>
          </div>
          {entry.description && (
            <div className="mt-1 text-[13px] text-[#202B35]">{entry.description}</div>
          )}
          {entry.meta && <div className="mt-1.5">{entry.meta}</div>}
        </li>
      ))}
    </ol>
  );
};
