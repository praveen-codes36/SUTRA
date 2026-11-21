import type { ActionItem, Decision, Person } from '../types/api';

export interface ApprovalChainStep {
  id: string;
  stageLabel: string;
  timestamp: string | null;
  title: string;
  actorCapacity: string;
  actor: Person | null;
  emailIds: string[];
  decision?: Decision;
  action?: ActionItem;
}

export function getDecisionActor(decision: Decision): { capacityLabel: string; person: Person | null } {
  if (decision.approver) {
    return { capacityLabel: 'Approver', person: decision.approver };
  }
  if (decision.confirmed_by) {
    return { capacityLabel: 'Confirmed by', person: decision.confirmed_by };
  }
  if (decision.recommended_by) {
    return { capacityLabel: 'Recommended by', person: decision.recommended_by };
  }
  return { capacityLabel: 'Actor', person: null };
}

export function buildApprovalChain(
  threadDecisions: Decision[],
  threadActions: ActionItem[],
): ApprovalChainStep[] {
  const steps: ApprovalChainStep[] = [];

  for (const dec of threadDecisions) {
    const actorInfo = getDecisionActor(dec);
    let stage = 'Decision';
    if (dec.type === 'RECOMMENDATION') stage = 'Recommendation';
    else if (dec.type === 'APPROVAL' || dec.type === 'CONDITIONAL_APPROVAL') stage = 'Approval';
    else if (dec.type === 'CONFIRMATION' || dec.type === 'SELECTION') stage = 'Confirmation';
    else if (dec.type === 'LIMITED_SCOPE_ACCEPTANCE') stage = 'Limited Scope Acceptance';
    else if (dec.type === 'REJECTION') stage = 'Rejection';

    const emailIds = dec.evidence.map((e) => e.email_id).filter(Boolean);

    steps.push({
      id: `dec-${dec.decision_id}`,
      stageLabel: stage,
      timestamp: dec.decided_at || null,
      title: dec.subject || dec.outcome,
      actorCapacity: actorInfo.capacityLabel,
      actor: actorInfo.person,
      emailIds,
      decision: dec,
    });
  }

  for (const act of threadActions) {
    const emailIds = act.evidence.map((e) => e.email_id).filter(Boolean);
    steps.push({
      id: `act-${act.action_id}`,
      stageLabel: 'Execution',
      timestamp: act.completed_at || act.deadline.date || null,
      title: act.task,
      actorCapacity: act.owner ? 'Assignee' : 'Requested by',
      actor: act.owner || act.requested_by,
      emailIds,
      action: act,
    });
  }

  steps.sort((a, b) => {
    if (!a.timestamp && !b.timestamp) return 0;
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  return steps;
}

export function computeDecisionSummary(decisions: Decision[]) {
  let approvals = 0;
  let approvalCount = 0;
  let conditionalApprovalCount = 0;
  let rejections = 0;
  let requiringReview = 0;
  let limitedScope = 0;
  let recommendations = 0;
  let confirmations = 0;
  let selections = 0;

  for (const d of decisions) {
    if (d.type === 'APPROVAL') {
      approvals++;
      approvalCount++;
    } else if (d.type === 'CONDITIONAL_APPROVAL') {
      approvals++;
      conditionalApprovalCount++;
    } else if (d.type === 'REJECTION') {
      rejections++;
    } else if (d.type === 'LIMITED_SCOPE_ACCEPTANCE') {
      limitedScope++;
    } else if (d.type === 'RECOMMENDATION') {
      recommendations++;
    } else if (d.type === 'CONFIRMATION') {
      confirmations++;
    } else if (d.type === 'SELECTION') {
      selections++;
    }

    if (d.review_state === 'PENDING') {
      requiringReview++;
    }
  }

  return {
    total: decisions.length,
    approvals,
    approvalCount,
    conditionalApprovalCount,
    rejections,
    requiringReview,
    limitedScope,
    recommendations,
    confirmations,
    selections,
  };
}

export function computeActionSummary(actions: ActionItem[]) {
  let open = 0;
  let conditional = 0;
  let done = 0;
  let inProgressCount = 0;
  let blockedCount = 0;
  const unknownMap = new Map<string, number>();

  const knownStatuses = new Set([
    'OPEN',
    'DONE',
    'CONDITIONAL',
    'CANCELLED',
    'SUPERSEDED',
    'IN_PROGRESS',
    'BLOCKED',
  ]);

  for (const a of actions) {
    if (a.status === 'OPEN') open++;
    else if (a.status === 'DONE') done++;
    else if (a.status === 'CONDITIONAL') conditional++;
    else if (a.status === 'IN_PROGRESS') inProgressCount++;
    else if (a.status === 'BLOCKED') blockedCount++;
    else if (!knownStatuses.has(a.status)) {
      unknownMap.set(a.status, (unknownMap.get(a.status) || 0) + 1);
    }
  }

  const unknownStatuses = Array.from(unknownMap.entries()).map(([status, count]) => ({
    status,
    count,
  }));

  return {
    total: actions.length,
    open,
    conditional,
    done,
    inProgress: inProgressCount > 0 ? inProgressCount : null,
    blocked: blockedCount > 0 ? blockedCount : null,
    unknownStatuses,
  };
}
