import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-start justify-center rounded-[8px] border border-[#E5E2D9] bg-white px-6 py-8 ${className}`}
    >
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-[4px] bg-[#E8EFEA] text-[#102D2A]">
        {icon ?? <Inbox size={20} aria-hidden="true" />}
      </div>
      <h2 className="font-display text-[16px] font-semibold text-[#102D2A]">{title}</h2>
      <p className="mt-1.5 max-w-[58ch] text-[14px] leading-[1.55] text-[#5A6560]">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
