import React from 'react';
import { Check, Info, X } from 'lucide-react';
import { usePrefs } from '../../hooks/usePrefs';
import {
  formatAmountValue,
  formatDateTime,
  formatUtcTooltip,
} from '../../lib/format';
import {
  AMOUNT_ROLE_LABELS,
  CONDITION_STATE_META,
  DECISION_STATUS_META,
  DECISION_TYPE_META,
} from '../../lib/semantics';
import { isProvenanceReported, normaliseConditions } from '../../adapters/normalisers';
import type { Decision, DecisionType } from '../../types/api';
import { CitationChip, type CitationInspectTarget } from '../evidence/CitationChip';
import { ProvenanceTag } from '../evidence/ProvenanceTag';
import { Badge, StatusPill } from '../ui/Badge';
import { RolePill } from '../ui/RolePill';

export interface ThreadDecisionsSectionProps {
  decisions: Decision[];
  showUtc: boolean;
  onNavigateEmail: (emailId: string, quote?: string | null) => void;
  onInspectAttachment: (target: CitationInspectTarget) => void;
}

const DECISION_BORDER_ACCENT: Record<DecisionType, string> = {
  RECOMMENDATION: 'border-l-4 border-l-[#1F5A8A]',
  CONDITIONAL_APPROVAL: 'border-l-4 border-l-[#8A5A00]',
  LIMITED_SCOPE_ACCEPTANCE: 'border-l-4 border-l-[#8A5A00] bg-[#FBF0D9]/15',
  APPROVAL: 'border-l-4 border-l-[#1E6B45]',
  REJECTION: 'border-l-4 border-l-[#A3342B]',
  SELECTION: 'border-l-4 border-l-[#102D2A]',
  CONFIRMATION: 'border-l-4 border-l-[#102D2A]',
};

export const ThreadDecisionsSection: React.FC<ThreadDecisionsSectionProps> = ({
  decisions,
  showUtc,
  onNavigateEmail,
  onInspectAttachment,
}) => {
  const { prefs } = usePrefs();

  return (
    <section aria-label="Decisions identified in this conversation" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[17px] font-semibold text-[#102D2A]">
          Decisions &amp; formal positions ({decisions.length})
        </h2>
        <span className="text-[12px] text-[#5A6560]">
          Recommendations, conditional approvals, limited-scope acceptances, and confirmations remain strictly distinct.
        </span>
      </div>

      {decisions.length === 0 ? (
        <div className="rounded-[8px] border border-[#E5E2D9] bg-white p-5 text-[13px] text-[#5A6560]">
          No formal decisions, recommendations, or confirmations are recorded in this conversation.
        </div>
      ) : (
        <div className="space-y-3">
          {decisions.map((dec) => {
            const typeMeta = DECISION_TYPE_META[dec.type];
            const statusMeta = DECISION_STATUS_META[dec.status];
            const conditions = normaliseConditions(dec.scope.conditions);
            const isInferred = dec.provenance === 'INFERRED';
            const hasScopeLists =
              dec.scope.authorizes.length > 0 || dec.scope.excludes.length > 0;

            return (
              <article
                key={dec.decision_id}
                data-testid={`decision-card-${dec.decision_id}`}
                className={`rounded-[8px] border ${
                  isInferred ? 'border-dashed border-[#8A5A00]/70' : 'border-[#E5E2D9]'
                } ${DECISION_BORDER_ACCENT[dec.type]} bg-white p-5`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      label={typeMeta.label}
                      tone={typeMeta.tone}
                      icon={typeMeta.icon}
                      title={typeMeta.tooltip}
                    />
                    <StatusPill
                      label={statusMeta.label}
                      tone={statusMeta.tone}
                      icon={statusMeta.icon}
                      title={statusMeta.tooltip}
                    />
                    <ProvenanceTag
                      provenance={dec.provenance}
                      reported={isProvenanceReported(dec)}
                    />
                  </div>
                  <span
                    title={formatUtcTooltip(dec.decided_at)}
                    className="text-[12px] text-[#5A6560] tabular-nums"
                  >
                    {formatDateTime(dec.decided_at, { showUtc })}
                  </span>
                </div>

                <h3 className="mt-2.5 font-display text-[15px] font-semibold text-[#102D2A]">
                  {dec.subject}
                </h3>
                <p className="mt-1 text-[14px] leading-[1.55] text-[#202B35]">{dec.outcome}</p>

                {dec.type === 'RECOMMENDATION' && (
                  <p className="mt-2 rounded-[4px] border border-[#1F5A8A]/25 bg-[#E1ECF5]/50 px-3 py-1.5 text-[12.5px] font-medium text-[#1F5A8A]">
                    Recommendation only — forwarded for authority review; does not constitute approval.
                  </p>
                )}

                {dec.type === 'LIMITED_SCOPE_ACCEPTANCE' && (
                  <p className="mt-2 rounded-[4px] border border-[#8A5A00]/30 bg-[#FBF0D9]/65 px-3 py-1.5 text-[12.5px] font-medium text-[#8A5A00]">
                    Bounded acceptance — inspect both “Authorizes” and “Does not authorize” below before proceeding.
                  </p>
                )}

                {/* Attribution / capacity rows */}
                <dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
                  {dec.recommended_by && (
                    <div>
                      <dt className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
                        Recommended by
                      </dt>
                      <dd className="mt-1">
                        <RolePill person={dec.recommended_by} />
                      </dd>
                    </div>
                  )}
                  {dec.approver && (
                    <div>
                      <dt className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
                        {dec.type === 'LIMITED_SCOPE_ACCEPTANCE'
                          ? 'Accepted by (limited scope)'
                          : 'Approved by'}
                      </dt>
                      <dd className="mt-1">
                        <RolePill person={dec.approver} />
                      </dd>
                    </div>
                  )}
                  {dec.confirmed_by && (
                    <div>
                      <dt className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
                        Confirmed by
                      </dt>
                      <dd className="mt-1">
                        <RolePill person={dec.confirmed_by} />
                      </dd>
                    </div>
                  )}
                  {dec.amounts.length > 0 && (
                    <div>
                      <dt className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
                        Amounts
                      </dt>
                      <dd className="mt-1 flex flex-wrap gap-2">
                        {dec.amounts.map((amt, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#E5E2D9] bg-[#F5F2EA] px-2.5 py-1 text-[12.5px] font-medium text-[#102D2A] tabular-nums"
                          >
                            <span className="font-display text-[11px] font-semibold uppercase text-[#7A5C1E]">
                              {AMOUNT_ROLE_LABELS[amt.role]}:
                            </span>
                            <span>{formatAmountValue(amt, prefs.amountDisplay)}</span>
                            {amt.basis && (
                              <span className="text-[11px] text-[#5A6560]">
                                ({amt.basis === 'PER_UNIT' ? 'per unit' : 'total'})
                              </span>
                            )}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>

                {/* Relayed-statement / attribution_note */}
                {dec.attribution_note && (
                  <div className="mt-3 flex items-start gap-2 rounded-[4px] border border-[#1F5A8A]/25 bg-[#E1ECF5]/45 px-3 py-2 text-[12.5px] text-[#1F5A8A]">
                    <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{dec.attribution_note}</span>
                  </div>
                )}

                {/* Authorizes / Does not authorize side-by-side */}
                {hasScopeLists && (
                  <div className="mt-3 grid gap-3 rounded-[6px] border border-[#E5E2D9] bg-[#F5F2EA]/50 p-3 sm:grid-cols-2">
                    <div>
                      <p className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#1E6B45]">
                        Authorizes
                      </p>
                      {dec.scope.authorizes.length === 0 ? (
                        <p className="mt-1 text-[12.5px] text-[#5A6560]">Nothing explicitly authorized</p>
                      ) : (
                        <ul className="mt-1.5 space-y-1 text-[13px] text-[#202B35]">
                          {dec.scope.authorizes.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <Check size={14} className="mt-0.5 shrink-0 text-[#1E6B45]" aria-hidden="true" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#A3342B]">
                        Does not authorize
                      </p>
                      {dec.scope.excludes.length === 0 ? (
                        <p className="mt-1 text-[12.5px] text-[#5A6560]">No explicit exclusions listed</p>
                      ) : (
                        <ul className="mt-1.5 space-y-1 text-[13px] text-[#202B35]">
                          {dec.scope.excludes.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <X size={14} className="mt-0.5 shrink-0 text-[#A3342B]" aria-hidden="true" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}

                {/* Conditions with states */}
                {conditions.length > 0 && (
                  <div className="mt-3 border-t border-[#E5E2D9] pt-3">
                    <p className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
                      Stated conditions ({conditions.length})
                    </p>
                    <ul className="mt-2 space-y-2">
                      {conditions.map((cond, idx) => {
                        const stateKey = cond.state || 'NOT_EVIDENCED';
                        const condMeta = CONDITION_STATE_META[stateKey];
                        return (
                          <li
                            key={idx}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border border-[#E5E2D9] bg-[#F5F2EA]/40 px-3 py-2 text-[13px]"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-[#202B35]">
                                {cond.text} — {condMeta.label.toLowerCase()}
                              </span>
                              {cond.evidence_email_ids &&
                                cond.evidence_email_ids.map((eid) => (
                                  <CitationChip
                                    key={`${idx}-${eid}`}
                                    emailId={eid}
                                    label={`(${eid})`}
                                    onInspect={(t) => onNavigateEmail(t.emailId)}
                                  />
                                ))}
                            </div>
                            <StatusPill
                              label={condMeta.label}
                              tone={condMeta.tone}
                              icon={condMeta.icon}
                              title={condMeta.tooltip}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Evidence links */}
                {dec.evidence.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#E5E2D9] pt-3">
                    <span className="text-[12px] font-medium text-[#5A6560]">Evidence:</span>
                    {dec.evidence.map((ev, idx) => (
                      <CitationChip
                        key={`${dec.decision_id}-ev-${idx}`}
                        emailId={ev.email_id}
                        quote={ev.quote}
                        attachmentId={ev.attachment_id}
                        label={
                          ev.attachment_filename
                            ? `${ev.email_id} · ${ev.attachment_filename}`
                            : ev.email_id
                        }
                        onInspect={(t) => {
                          if (t.attachmentId) {
                            onInspectAttachment({
                              emailId: t.emailId,
                              attachmentId: t.attachmentId,
                              quote: t.quote,
                              tab: 'attachment',
                            });
                          } else {
                            onNavigateEmail(t.emailId, t.quote);
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
