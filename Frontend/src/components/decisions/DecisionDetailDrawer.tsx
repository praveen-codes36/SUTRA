import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ExternalLink, Info, ShieldAlert, X } from 'lucide-react';
import { isProvenanceReported, normaliseConditions } from '../../adapters/normalisers';
import { usePrefs } from '../../hooks/usePrefs';
import { formatAmountValue, formatDateTime, formatUtcTooltip } from '../../lib/format';
import { buildApprovalChain, getDecisionActor } from '../../lib/ledgerHelpers';
import {
  AMOUNT_ROLE_LABELS,
  CONDITION_STATE_META,
  DECISION_STATUS_META,
  DECISION_TYPE_META,
} from '../../lib/semantics';
import type { ActionItem, Decision } from '../../types/api';
import { CitationChip, type CitationInspectTarget } from '../evidence/CitationChip';
import { ProvenanceTag } from '../evidence/ProvenanceTag';
import { Badge, StatusPill } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { RolePill } from '../ui/RolePill';

export interface DecisionDetailDrawerProps {
  decision: Decision | null;
  threadDecisions: Decision[];
  threadActions: ActionItem[];
  showUtc: boolean;
  onClose: () => void;
  onInspectEvidence: (target: CitationInspectTarget) => void;
}

export const DecisionDetailDrawer: React.FC<DecisionDetailDrawerProps> = ({
  decision,
  threadDecisions,
  threadActions,
  showUtc,
  onClose,
  onInspectEvidence,
}) => {
  const { prefs } = usePrefs();

  if (!decision) {
    return (
      <Drawer open={false} onClose={onClose} title="Decision details">
        <div />
      </Drawer>
    );
  }

  const typeMeta = DECISION_TYPE_META[decision.type];
  const statusMeta = DECISION_STATUS_META[decision.status];
  const actorInfo = getDecisionActor(decision);
  const conditions = normaliseConditions(decision.scope.conditions);
  const chain = buildApprovalChain(threadDecisions, threadActions);
  const primaryEvidence = decision.evidence[0];

  return (
    <Drawer
      open={Boolean(decision)}
      onClose={onClose}
      title={decision.subject}
      subtitle={`${decision.decision_id} · Conversation ${decision.thread_key}`}
      widthClass="max-w-[660px]"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
          <Link
            to={`/app/threads/${encodeURIComponent(decision.thread_key)}`}
            onClick={onClose}
            className="inline-flex items-center gap-1.5 font-display font-semibold text-[#102D2A] hover:underline"
          >
            <span>Open complete conversation</span>
            <ExternalLink size={13} aria-hidden="true" />
          </Link>

          {primaryEvidence && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                onInspectEvidence({
                  emailId: primaryEvidence.email_id,
                  quote: primaryEvidence.quote,
                  attachmentId: primaryEvidence.attachment_id ?? null,
                  tab: primaryEvidence.attachment_id ? 'attachment' : 'email',
                })
              }
            >
              Open source email ({primaryEvidence.email_id})
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5" data-testid={`decision-drawer-${decision.decision_id}`}>
        {/* Badges & provenance */}
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
            provenance={decision.provenance}
            reported={isProvenanceReported(decision)}
          />
        </div>

        {/* Special guardrails for recommendations and limited-scope acceptances */}
        {decision.type === 'RECOMMENDATION' && (
          <div className="flex items-start gap-2 rounded-[6px] border border-[#1F5A8A]/35 bg-[#E1ECF5]/60 p-3 text-[13px] text-[#1F5A8A]">
            <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong>Recommendation only:</strong> Forwarded for authority review. Does not constitute approval or authorize execution.
            </span>
          </div>
        )}

        {decision.type === 'LIMITED_SCOPE_ACCEPTANCE' && (
          <div className="flex items-start gap-2 rounded-[6px] border border-[#8A5A00]/40 bg-[#FBF0D9]/75 p-3 text-[13px] text-[#8A5A00]">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong>Bounded acceptance:</strong> Applies strictly to what is listed under “Authorizes” below. It is not purchase authorization or general approval.
            </span>
          </div>
        )}

        {/* Complete decision text */}
        <section aria-label="Decision text">
          <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
            Complete decision text
          </h3>
          <p className="mt-1.5 text-[14.5px] leading-[1.6] text-[#202B35]">{decision.outcome}</p>
        </section>

        {/* Metadata */}
        <dl className="grid gap-3 rounded-[6px] border border-[#E5E2D9] bg-[#F5F2EA]/50 p-3.5 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
              {actorInfo.capacityLabel}
            </dt>
            <dd className="mt-1">
              <RolePill person={actorInfo.person} unknownLabel="Actor not stated" />
            </dd>
          </div>

          <div>
            <dt className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
              Decision date
            </dt>
            <dd className="mt-1 space-y-0.5 tabular-nums">
              <div className="font-medium text-[#202B35]">
                {formatDateTime(decision.decided_at, { showUtc })}
              </div>
              <div className="text-[11.5px] text-[#5A6560]">
                {formatUtcTooltip(decision.decided_at)}
              </div>
            </dd>
          </div>

          <div>
            <dt className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
              Related conversation
            </dt>
            <dd className="mt-1">
              <Link
                to={`/app/threads/${encodeURIComponent(decision.thread_key)}`}
                onClick={onClose}
                className="font-mono text-[12.5px] font-semibold text-[#102D2A] hover:underline"
              >
                {decision.thread_key}
              </Link>
            </dd>
          </div>

          {decision.amounts.length > 0 && (
            <div>
              <dt className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
                Amounts
              </dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {decision.amounts.map((amt, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-[4px] border border-[#E5E2D9] bg-white px-2 py-0.5 text-[12.5px] font-medium text-[#102D2A] tabular-nums"
                  >
                    <span className="font-display text-[11px] font-semibold uppercase text-[#7A5C1E]">
                      {AMOUNT_ROLE_LABELS[amt.role]}:
                    </span>
                    <span>{formatAmountValue(amt, prefs.amountDisplay)}</span>
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>

        {/* Attribution note */}
        {decision.attribution_note && (
          <div className="flex items-start gap-2 rounded-[6px] border border-[#1F5A8A]/30 bg-[#E1ECF5]/45 p-3 text-[13px] text-[#1F5A8A]">
            <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em]">
                Attribution note
              </p>
              <p className="mt-0.5">{decision.attribution_note}</p>
            </div>
          </div>
        )}

        {/* Authorizes / Does not authorize */}
        {(decision.scope.authorizes.length > 0 || decision.scope.excludes.length > 0) && (
          <section aria-label="Scope of authorization">
            <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
              Scope &amp; exclusions
            </h3>
            <div className="mt-2 grid gap-3 rounded-[6px] border border-[#E5E2D9] bg-[#F5F2EA]/50 p-3.5 sm:grid-cols-2">
              <div>
                <p className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#1E6B45]">
                  Authorizes
                </p>
                {decision.scope.authorizes.length === 0 ? (
                  <p className="mt-1 text-[12.5px] text-[#5A6560]">Nothing explicitly authorized</p>
                ) : (
                  <ul className="mt-1.5 space-y-1 text-[13px] text-[#202B35]">
                    {decision.scope.authorizes.map((item, idx) => (
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
                {decision.scope.excludes.length === 0 ? (
                  <p className="mt-1 text-[12.5px] text-[#5A6560]">No explicit exclusions listed</p>
                ) : (
                  <ul className="mt-1.5 space-y-1 text-[13px] text-[#202B35]">
                    {decision.scope.excludes.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <X size={14} className="mt-0.5 shrink-0 text-[#A3342B]" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Conditions with states */}
        {conditions.length > 0 && (
          <section aria-label="Stated conditions">
            <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
              Conditions ({conditions.length})
            </h3>
            <ul className="mt-2 space-y-2">
              {conditions.map((cond, idx) => {
                const stateKey = cond.state || 'NOT_EVIDENCED';
                const condMeta = CONDITION_STATE_META[stateKey];
                return (
                  <li
                    key={idx}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-[#E5E2D9] bg-[#F5F2EA]/40 px-3 py-2.5 text-[13px]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[#202B35]">
                        {cond.text} — {condMeta.label.toLowerCase()}
                      </span>
                      {cond.evidence_email_ids?.map((eid) => (
                        <CitationChip
                          key={`${idx}-${eid}`}
                          emailId={eid}
                          label={eid}
                          onInspect={(t) => onInspectEvidence(t)}
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
          </section>
        )}

        {/* Evidence excerpts */}
        <section aria-label="Evidence excerpts">
          <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
            Evidence excerpts ({decision.evidence.length})
          </h3>
          {decision.evidence.length === 0 ? (
            <p className="mt-1.5 text-[13px] text-[#5A6560]">
              No verbatim quote recorded on this decision.
            </p>
          ) : (
            <div className="mt-2 space-y-2.5">
              {decision.evidence.map((ev, idx) => (
                <div
                  key={`${decision.decision_id}-ev-${idx}`}
                  className="rounded-[6px] border border-[#E5E2D9] bg-[#F5F2EA]/45 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CitationChip
                      emailId={ev.email_id}
                      quote={ev.quote}
                      attachmentId={ev.attachment_id}
                      label={
                        ev.attachment_filename
                          ? `${ev.email_id} · ${ev.attachment_filename}`
                          : ev.email_id
                      }
                      onInspect={onInspectEvidence}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onInspectEvidence({
                          emailId: ev.email_id,
                          quote: ev.quote,
                          attachmentId: ev.attachment_id ?? null,
                          tab: ev.attachment_id ? 'attachment' : 'email',
                        })
                      }
                      className="text-[12px] font-semibold text-[#102D2A] hover:underline cursor-pointer"
                    >
                      Open source email
                    </button>
                  </div>
                  <blockquote className="mt-2 border-l-2 border-[#D5B77B] pl-3 text-[13px] leading-[1.55] text-[#202B35]">
                    <mark className="rounded-[2px] bg-[#FBF0D9] px-1 py-0.5 text-[#102D2A]">
                      “{ev.quote}”
                    </mark>
                  </blockquote>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Thread approval chain view */}
        <section aria-label="Conversation approval chain">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
              Approval chain ({decision.thread_key})
            </h3>
            <span className="text-[11.5px] text-[#5A6560]">
              Recommendation → approval → confirmation → execution
            </span>
          </div>

          {chain.length === 0 ? (
            <p className="mt-1.5 text-[13px] text-[#5A6560]">
              Loading conversation chain…
            </p>
          ) : (
            <ol className="mt-2.5 space-y-2 border-l-2 border-[#E5E2D9] pl-4">
              {chain.map((step) => {
                const isCurrent = step.decision?.decision_id === decision.decision_id;
                return (
                  <li
                    key={step.id}
                    className={`rounded-[6px] border p-3 text-[12.5px] ${
                      isCurrent
                        ? 'border-[#102D2A] bg-[#E8EFEA]/55'
                        : 'border-[#E5E2D9] bg-white'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-display text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[#7A5C1E]">
                        {step.stageLabel}
                      </span>
                      {step.timestamp && (
                        <span
                          title={formatUtcTooltip(step.timestamp)}
                          className="text-[11.5px] text-[#5A6560] tabular-nums"
                        >
                          {formatDateTime(step.timestamp, { showUtc })}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-display font-semibold text-[#102D2A]">{step.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[#5A6560]">
                      <span>{step.actorCapacity}:</span>
                      <RolePill person={step.actor} unknownLabel="Not stated" />
                      {step.emailIds.slice(0, 2).map((eid, idx) => (
                        <CitationChip
                          key={`${step.id}-${eid}-${idx}`}
                          emailId={eid}
                          label={eid}
                          onInspect={(t) => onInspectEvidence(t)}
                        />
                      ))}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </Drawer>
  );
};
