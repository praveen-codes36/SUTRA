import React from 'react';
import { Calculator } from 'lucide-react';
import { formatINR } from '../../lib/format';
import type { Calculation, Citation } from '../../types/api';
import { CitationChip, type CitationInspectTarget } from './CitationChip';
import { ProvenanceTag } from './ProvenanceTag';

export interface CalculationBlockProps {
  calculation: Calculation;
  citations?: Citation[];
  onInspectCitation?: (target: CitationInspectTarget) => void;
  className?: string;
}

const OP_SYMBOL: Record<Calculation['operation'], string> = {
  SUM: '+',
  DIFFERENCE: '−',
  PRODUCT: '×',
};

export const CalculationBlock: React.FC<CalculationBlockProps> = ({
  calculation,
  citations = [],
  onInspectCitation,
  className = '',
}) => {
  const citById = new Map(citations.map((c) => [c.citation_id, c]));
  const symbol = OP_SYMBOL[calculation.operation] || '+';

  return (
    <div
      className={`rounded-[4px] border border-[#7B8581]/60 bg-[#F5F2EA]/75 p-3.5 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E2D9] pb-2">
        <div className="flex items-center gap-1.5 font-display text-[12px] font-semibold text-[#102D2A]">
          <Calculator size={14} aria-hidden="true" />
          <span>Derived calculation</span>
        </div>
        <ProvenanceTag provenance="DERIVED_CALC" />
      </div>

      <ul className="mt-2.5 space-y-2 text-[13px]">
        {calculation.operands.map((op, idx) => (
          <li
            key={`${op.label}-${idx}`}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              {idx > 0 && (
                <span className="font-mono text-[12px] font-semibold text-[#7A5C1E]">
                  {symbol}
                </span>
              )}
              <span className="text-[#202B35]">{op.label}</span>
              {op.citation_ids.map((cid) => {
                const cit = citById.get(cid);
                return cit ? (
                  <CitationChip
                    key={cid}
                    citation={cit}
                    onInspect={onInspectCitation}
                  />
                ) : null;
              })}
            </div>
            <span className="font-mono text-[13px] font-medium text-[#202B35] tabular-nums">
              {formatINR(op.value_inr)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-[#7B8581]/50 pt-2.5 text-[14px]">
        <span className="font-display font-semibold text-[#102D2A]">Result</span>
        <span className="font-mono font-bold text-[#102D2A] tabular-nums">
          {formatINR(calculation.result_inr)}
        </span>
      </div>
    </div>
  );
};
