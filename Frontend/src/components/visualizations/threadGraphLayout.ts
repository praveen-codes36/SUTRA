import type {
  ActionItem,
  Decision,
  EmailMessage,
  ThreadDetail,
  ThreadEdge,
} from '../../types/api';

export interface ThreadGraphNode {
  email: EmailMessage;
  index: number;
  x: number;
  y: number;
  hasDecision: boolean;
  decisionCount: number;
  actionCount: number;
  attachmentCount: number;
}

export interface ThreadGraphGap {
  id: string;
  fromEmailId: string;
  toEmailId: string;
  fromX: number;
  toX: number;
  midX: number;
  days: number;
  label: string;
}

export interface ThreadGraphArc {
  id: string;
  childId: string;
  parentId: string;
  fromX: number;
  toX: number;
  y: number;
  arcHeight: number;
  edgeType: ThreadEdge['edge_type'];
  anomaly?: string | null;
}

export interface ThreadGraphModel {
  width: number;
  height: number;
  spineY: number;
  nodes: ThreadGraphNode[];
  gaps: ThreadGraphGap[];
  arcs: ThreadGraphArc[];
}

const MS_PER_DAY = 86_400_000;
const LARGE_GAP_THRESHOLD_DAYS = 7;

export function buildThreadGraph(
  thread: ThreadDetail | undefined,
  emails: EmailMessage[],
  decisions: Decision[],
  actions: ActionItem[],
): ThreadGraphModel {
  const sorted = emails
    .slice()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const decisionCounts = new Map<string, number>();
  for (const dec of decisions) {
    const seenInDec = new Set<string>();
    for (const ev of dec.evidence) {
      if (ev.email_id && !seenInDec.has(ev.email_id)) {
        seenInDec.add(ev.email_id);
        decisionCounts.set(ev.email_id, (decisionCounts.get(ev.email_id) ?? 0) + 1);
      }
    }
  }

  const actionCounts = new Map<string, number>();
  for (const act of actions) {
    const seenInAct = new Set<string>();
    for (const ev of [...act.evidence, ...act.completion_evidence]) {
      if (ev.email_id && !seenInAct.has(ev.email_id)) {
        seenInAct.add(ev.email_id);
        actionCounts.set(ev.email_id, (actionCounts.get(ev.email_id) ?? 0) + 1);
      }
    }
  }

  const padX = 76;
  const baseStep = 148;
  const extraGapStep = 44;
  const spineY = 122;
  const height = 228;

  const gaps: ThreadGraphGap[] = [];
  const xPositions: number[] = [];
  let cursorX = padX;

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const prevMs = new Date(sorted[i - 1].timestamp).getTime();
      const currMs = new Date(sorted[i].timestamp).getTime();
      const diffDays = Math.round((currMs - prevMs) / MS_PER_DAY);
      const hasLargeGap = Number.isFinite(diffDays) && diffDays >= LARGE_GAP_THRESHOLD_DAYS;
      const step = hasLargeGap ? baseStep + extraGapStep : baseStep;
      const prevX = cursorX;
      cursorX += step;
      if (hasLargeGap) {
        gaps.push({
          id: `gap-${sorted[i - 1].email_id}-${sorted[i].email_id}`,
          fromEmailId: sorted[i - 1].email_id,
          toEmailId: sorted[i].email_id,
          fromX: prevX,
          toX: cursorX,
          midX: Math.round((prevX + cursorX) / 2),
          days: diffDays,
          label: `${diffDays} ${diffDays === 1 ? 'day' : 'days'} later`,
        });
      }
    }
    xPositions.push(cursorX);
  }

  const width = Math.max(680, (xPositions[xPositions.length - 1] ?? padX) + padX);

  const nodeById = new Map<string, ThreadGraphNode>();
  const nodes: ThreadGraphNode[] = sorted.map((email, index) => {
    const dCount = decisionCounts.get(email.email_id) ?? 0;
    const aCount = actionCounts.get(email.email_id) ?? 0;
    const node: ThreadGraphNode = {
      email,
      index,
      x: xPositions[index],
      y: spineY,
      hasDecision: dCount > 0,
      decisionCount: dCount,
      actionCount: aCount,
      attachmentCount: email.attachments.length,
    };
    nodeById.set(email.email_id, node);
    return node;
  });

  const arcs: ThreadGraphArc[] = [];
  const seenArcKeys = new Set<string>();
  const sourceEdges: ThreadEdge[] =
    thread?.edges && thread.edges.length > 0
      ? thread.edges
      : sorted.map((e) => ({
          child_email_id: e.email_id,
          parent_email_id: e.in_reply_to,
          edge_type: 'REPLY_TO',
        }));

  for (const edge of sourceEdges) {
    if (!edge.parent_email_id) continue;
    const child = nodeById.get(edge.child_email_id);
    const parent = nodeById.get(edge.parent_email_id);
    if (!child || !parent) continue;
    const key = `${child.email.email_id}->${parent.email.email_id}`;
    if (seenArcKeys.has(key)) continue;
    seenArcKeys.add(key);

    const span = Math.abs(child.index - parent.index);
    const arcHeight = Math.min(82, 28 + span * 16);
    arcs.push({
      id: key,
      childId: child.email.email_id,
      parentId: parent.email.email_id,
      fromX: child.x,
      toX: parent.x,
      y: spineY,
      arcHeight,
      edgeType: edge.edge_type,
      anomaly: edge.anomaly,
    });
  }

  return {
    width,
    height,
    spineY,
    nodes,
    gaps,
    arcs,
  };
}
