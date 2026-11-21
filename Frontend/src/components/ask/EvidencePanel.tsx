import React from 'react';
import { AlertTriangle, FileSearch, Sparkles } from 'lucide-react';
import { classifyAnswerEvidence } from '../../lib/askHelpers';
import { formatDateTime, formatUtcTooltip } from '../../lib/format';
import type { Answer, EmailMessage } from '../../types/api';
import { CalculationBlock } from '../evidence/CalculationBlock';
import type { CitationInspectTarget } from '../evidence/CitationChip';
import { CitationPopoverChip } from '../evidence/CitationPopoverChip';
import { ProvenanceTag } from '../evidence/ProvenanceTag';
import { SourceCard } from '../evidence/SourceCard';
import { RolePill } from '../ui/RolePill';

export interface EvidencePanelProps {
  answer: Answer | null;
  emailsById: Map<string, EmailMessage>;
  showUtc: boolean;
  onInspectCitation: (target: CitationInspectTarget) => void;
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({
  answer,
  emailsById,
  showUtc,
  onInspectCitation,
}) => {
  if (!answer) {
    return (
      <aside
        aria-label="Evidence inspection panel"
        className="rounded-[8px] border border-[#E5E2D9] bg-white p-5"
      >
        <div className="flex items-center gap-2 border-b border-[#E5E2D9] pb-3">
          <FileSearch size={17} className="text-[#102D2A]" aria-hidden="true" />
          <h2 className="font-display text-[16px] font-semibold text-[#102D2A]">
            Evidence panel
          </h2>
        </div>
        <p className="mt-3 text-[13.5px] leading-[1.55] text-[#5A6560]">
          Ask a question or choose a suggested prompt to inspect directly supported facts, derived calculations, inferences, caveats, and full retrieved email records side-by-side.
        </p>
      </aside>
    );
  }

  const classified = classifyAnswerEvidence(answer);

  return (
    <aside
      aria-label="Evidence inspection panel"
      data-testid="evidence-panel"
      className="space-y-5 rounded-[8px] border border-[#E5E2D9] bg-white p-4 sm:p-5"
    >
      <div className="border-b border-[#E5E2D9] pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[16px] font-semibold text-[#102D2A]">
            Evidence breakdown
          </h2>
          <span className="font-mono text-[12px] font-medium text-[#5A6560] tabular-nums">
            {classified.uniqueCitations.length} source{classified.uniqueCitations.length === 1 ? '' : 's'}
          </span>
        </div>
        {answer.question && (
          <p className="mt-1 text-[12.5px] text-[#5A6560] line-clamp-2">{answer.question}</p>
        )}
      </div>

      {/* Conflicting evidence side-by-side when status === CONFLICTING_EVIDENCE */}
      {answer.status === 'CONFLICTING_EVIDENCE' && (
        <section aria-label="Conflicting evidence" className="space-y-2">
          <h3 className="flex items-center gap-1.5 font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#A3342B]">
            <AlertTriangle size={13} aria-hidden="true" />
            <span>Conflicting evidence</span>
          </h3>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {classified.uniqueCitations.map((cit) => (
              <div
                key={`conflict-${cit.citation_id}`}
                className="rounded-[6px] border border-[#A3342B]/35 bg-[#F9E4E1]/40 p-3 text-[12.5px]"
              >
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="font-mono font-semibold text-[#102D2A]">{cit.email_id}</span>
                  <span
                    title={formatUtcTooltip(cit.timestamp)}
                    className="text-[11px] text-[#5A6560] tabular-nums"
                  >
                    {formatDateTime(cit.timestamp, { showUtc })}
                  </span>
                </div>
                {cit.sender && (
                  <div className="mt-1">
                    <RolePill person={cit.sender} />
                  </div>
                )}
                {cit.quote && <p className="mt-1.5 text-[#202B35]">“{cit.quote}”</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 1. Directly supported facts (EXPLICIT) */}
      <section aria-label="Directly supported facts" data-testid="evidence-section-explicit">
        <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#102D2A]">
          Directly supported facts ({classified.explicitBlocks.length})
        </h3>
        {classified.explicitBlocks.length === 0 ? (
          <p className="mt-1.5 text-[12.5px] text-[#5A6560]">
            No explicit fact claims in this response.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {classified.explicitBlocks.map((block) => (
              <li
                key={`ev-exp-${block.claim_id}`}
                className="rounded-[6px] border border-[#E5E2D9] bg-[#F5F2EA]/40 p-3 text-[13px] leading-[1.5] text-[#202B35]"
              >
                <span>{block.text}</span>
                {block.citation_ids.length > 0 && (
                  <span className="ml-1.5 inline-flex flex-wrap gap-1 align-baseline">
                    {block.citation_ids.map((cid) => {
                      const cit = classified.citationsById.get(cid);
                      return cit ? (
                        <CitationPopoverChip
                          key={`panel-exp-${block.claim_id}-${cid}`}
                          citation={cit}
                          indexNumber={classified.citationIndexMap.get(cid)}
                          emailBody={emailsById.get(cit.email_id)?.body_raw ?? null}
                          showUtc={showUtc}
                          onInspect={onInspectCitation}
                        />
                      ) : null;
                    })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 2. Derived calculations */}
      {classified.calculations.length > 0 && (
        <section aria-label="Derived calculations" data-testid="evidence-section-derived">
          <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#1F5A8A]">
            Derived calculations ({classified.calculations.length})
          </h3>
          <div className="mt-2 space-y-2.5">
            {classified.calculations.map(({ block, calculation }) => (
              <CalculationBlock
                key={`panel-calc-${block.claim_id}`}
                calculation={calculation}
                citations={answer.citations}
                onInspectCitation={onInspectCitation}
              />
            ))}
          </div>
        </section>
      )}

      {/* 3. Inferences (INFERRED, dashed) */}
      <section aria-label="Inferences" data-testid="evidence-section-inferred">
        <h3 className="flex items-center gap-1.5 font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8A5A00]">
          <Sparkles size={13} aria-hidden="true" />
          <span>Inferences ({classified.inferredBlocks.length})</span>
        </h3>
        {classified.inferredBlocks.length === 0 ? (
          <p className="mt-1.5 text-[12.5px] text-[#5A6560]">
            No inferred claims in this response.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {classified.inferredBlocks.map((block) => (
              <li
                key={`ev-inf-${block.claim_id}`}
                data-testid={`evidence-inferred-${block.claim_id}`}
                className="rounded-[6px] border border-dashed border-[#8A5A00]/75 bg-[#FBF0D9]/25 p-3 text-[13px] leading-[1.5] text-[#202B35]"
              >
                <div className="mb-1">
                  <ProvenanceTag provenance="INFERRED" />
                </div>
                <div>
                  <span>{block.text}</span>
                  {block.citation_ids.length > 0 && (
                    <span className="ml-1.5 inline-flex flex-wrap gap-1 align-baseline">
                      {block.citation_ids.map((cid) => {
                        const cit = classified.citationsById.get(cid);
                        return cit ? (
                          <CitationPopoverChip
                            key={`panel-inf-${block.claim_id}-${cid}`}
                            citation={cit}
                            indexNumber={classified.citationIndexMap.get(cid)}
                            emailBody={emailsById.get(cit.email_id)?.body_raw ?? null}
                            showUtc={showUtc}
                            onInspect={onInspectCitation}
                          />
                        ) : null;
                      })}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 4. Missing information / limitations */}
      <section aria-label="Missing information and limitations" data-testid="evidence-section-missing">
        <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
          Missing information / limitations
        </h3>
        {answer.caveats.length === 0 ? (
          <p className="mt-1.5 text-[12.5px] text-[#5A6560]">
            {answer.status === 'INSUFFICIENT_EVIDENCE'
              ? 'I could not find sufficient supporting information in the available email records.'
              : 'No missing information caveats recorded.'}
          </p>
        ) : (
          <ul className="mt-1.5 space-y-1 text-[12.5px] leading-[1.5] text-[#202B35]">
            {answer.caveats.map((c, idx) => (
              <li key={idx}>• {c}</li>
            ))}
          </ul>
        )}
      </section>

      {/* 5. Retrieved sources */}
      <section aria-label="Retrieved sources" data-testid="evidence-section-sources">
        <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
          Retrieved sources ({classified.uniqueCitations.length})
        </h3>
        {classified.uniqueCitations.length === 0 ? (
          <p className="mt-1.5 text-[12.5px] text-[#5A6560]">
            No email sources retrieved for this query.
          </p>
        ) : (
          <div className="mt-2 space-y-2.5">
            {classified.uniqueCitations.map((cit) => (
              <SourceCard
                key={cit.citation_id}
                citation={cit}
                email={emailsById.get(cit.email_id)}
                showUtc={showUtc}
                onInspect={onInspectCitation}
              />
            ))}
          </div>
        )}
      </section>
    </aside>
  );
};
