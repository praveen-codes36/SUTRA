import React from 'react';
import { PROVENANCE_META } from '../../lib/semantics';
import type { Provenance } from '../../types/api';
import { SemanticIcon } from './SemanticIcon';

export interface ProvenanceTagProps {
  provenance: Provenance;
  reported?: boolean;
  className?: string;
}

export const ProvenanceTag: React.FC<ProvenanceTagProps> = ({
  provenance,
  reported = true,
  className = '',
}) => {
  if (!reported) {
    return (
      <span
        title="Backend did not specify provenance for this item."
        className={`inline-flex items-center gap-1.5 rounded-[4px] border border-dashed border-[#7B8581] bg-[#F5F2EA] px-2 py-0.5 text-[12px] font-medium text-[#5A6560] whitespace-nowrap shrink-0 ${className}`}
      >
        <SemanticIcon name="HelpCircle" size={12} />
        <span>Provenance not reported</span>
      </span>
    );
  }

  const meta = PROVENANCE_META[provenance];
  const styleClass =
    provenance === 'EXPLICIT'
      ? 'border-solid border-[#102D2A]/30 bg-[#E8EFEA] text-[#102D2A]'
      : provenance === 'DERIVED_CALC'
        ? 'border-solid border-[#1F5A8A]/35 bg-[#E1ECF5] text-[#1F5A8A] provenance-derived-hatch'
        : 'border-dashed border-[#8A5A00]/70 bg-[#FBF0D9] text-[#8A5A00]';

  return (
    <span
      title={meta.tooltip}
      className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-0.5 text-[12px] font-medium whitespace-nowrap shrink-0 ${styleClass} ${className}`}
    >
      <SemanticIcon name={meta.icon} size={12} />
      <span>{meta.label}</span>
    </span>
  );
};
