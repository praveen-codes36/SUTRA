import React from 'react';
import { AlertTriangle, Info, ShieldAlert, XCircle } from 'lucide-react';

export type BannerTone = 'info' | 'warn' | 'error' | 'demo';

export interface BannerProps {
  tone?: BannerTone;
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const BANNER_STYLE: Record<BannerTone, { wrap: string; icon: React.ReactNode }> = {
  info: {
    wrap: 'bg-[#E1ECF5] text-[#1F5A8A] border-[#1F5A8A]/25',
    icon: <Info size={16} className="shrink-0 mt-0.5" aria-hidden="true" />,
  },
  warn: {
    wrap: 'bg-[#FBF0D9] text-[#8A5A00] border-[#8A5A00]/25',
    icon: <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />,
  },
  error: {
    wrap: 'bg-[#F9E4E1] text-[#A3342B] border-[#A3342B]/25',
    icon: <XCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />,
  },
  demo: {
    wrap: 'bg-[#E8EFEA] text-[#102D2A] border-[#7B8581]/50',
    icon: <ShieldAlert size={16} className="shrink-0 mt-0.5 text-[#7A5C1E]" aria-hidden="true" />,
  },
};

export const Banner: React.FC<BannerProps> = ({
  tone = 'info',
  title,
  children,
  action,
  className = '',
}) => {
  const style = BANNER_STYLE[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex flex-wrap items-start justify-between gap-3 border px-4 py-2.5 text-[13px] ${style.wrap} ${className}`}
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        {style.icon}
        <div className="min-w-0">
          {title && <span className="font-display font-semibold mr-1.5">{title}</span>}
          <span>{children}</span>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
