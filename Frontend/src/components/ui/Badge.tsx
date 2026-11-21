import React from 'react';
import type { SemanticIconName, StatusTone } from '../../lib/semantics';
import { SemanticIcon } from './SemanticIcon';

export interface BadgeProps {
  label: string;
  tone?: StatusTone;
  icon?: SemanticIconName;
  dashed?: boolean;
  title?: string;
  className?: string;
}

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-[#F5F2EA] text-[#202B35] border-[#7B8581]/60',
  success: 'bg-[#E3F1E8] text-[#1E6B45] border-[#1E6B45]/25',
  warning: 'bg-[#FBF0D9] text-[#8A5A00] border-[#8A5A00]/25',
  error: 'bg-[#F9E4E1] text-[#A3342B] border-[#A3342B]/25',
  info: 'bg-[#E1ECF5] text-[#1F5A8A] border-[#1F5A8A]/25',
  forest: 'bg-[#E8EFEA] text-[#102D2A] border-[#102D2A]/25',
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  tone = 'neutral',
  icon,
  dashed = false,
  title,
  className = '',
}) => {
  return (
    <span
      title={title ?? label}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-[4px] px-2 py-0.5 text-[12px] font-medium leading-tight whitespace-nowrap shrink-0 border ${
        dashed ? 'border-dashed' : 'border-solid'
      } ${TONE_CLASSES[tone]} ${className}`}
    >
      {icon && <SemanticIcon name={icon} size={13} className="shrink-0" />}
      <span className="truncate">{label}</span>
    </span>
  );
};

export const StatusPill = Badge;
