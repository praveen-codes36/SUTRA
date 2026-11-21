import type {
  Decision,
  EmailMessage,
  ThreadListItem,
  ThreadStatusClass,
} from '../../types/api';

export interface ConstellationNode {
  email: EmailMessage;
  threadKey: string;
  threadStatus: ThreadStatusClass;
  x: number;
  y: number;
  hasDecision: boolean;
  depthLayer: 0 | 1 | 2;
}

export interface ConstellationEdge {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  threadKey: string;
}

export interface ConstellationCluster {
  thread: ThreadListItem;
  cx: number;
  cy: number;
  radius: number;
  nodeCount: number;
}

export interface ConstellationGraph {
  width: number;
  height: number;
  clusters: ConstellationCluster[];
  nodes: ConstellationNode[];
  edges: ConstellationEdge[];
  decisionEmailIds: Set<string>;
}

export function buildConstellationGraph(
  threads: ThreadListItem[],
  emails: EmailMessage[],
  decisions: Decision[],
): ConstellationGraph {
  const decisionEmailIds = new Set<string>();
  for (const dec of decisions) {
    for (const ev of dec.evidence) {
      if (ev.email_id) {
        decisionEmailIds.add(ev.email_id);
      }
    }
  }

  const emailsByThread = new Map<string, EmailMessage[]>();
  for (const email of emails) {
    const bucket = emailsByThread.get(email.thread_key) || [];
    bucket.push(email);
    emailsByThread.set(email.thread_key, bucket);
  }

  const sortedThreads = threads
    .slice()
    .sort((a, b) => a.thread_key.localeCompare(b.thread_key));

  const cols = Math.min(5, Math.max(1, sortedThreads.length));
  const cellW = 192;
  const cellH = 196;
  const padX = 24;
  const padY = 26;
  const rows = Math.max(1, Math.ceil(sortedThreads.length / cols));
  const width = Math.max(640, padX * 2 + cols * cellW);
  const height = Math.max(240, padY * 2 + rows * cellH);

  const clusters: ConstellationCluster[] = [];
  const nodes: ConstellationNode[] = [];
  const edges: ConstellationEdge[] = [];
  const nodePosById = new Map<string, { x: number; y: number }>();

  sortedThreads.forEach((thread, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const cx = padX + col * cellW + cellW / 2;
    const cy = padY + row * cellH + 84;
    const threadEmails = (emailsByThread.get(thread.thread_key) || [])
      .slice()
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const orbitRadius = Math.min(56, 30 + threadEmails.length * 3.5);
    clusters.push({
      thread,
      cx,
      cy,
      radius: orbitRadius + 16,
      nodeCount: threadEmails.length,
    });

    const count = Math.max(1, threadEmails.length);
    threadEmails.forEach((email, eIdx) => {
      const angle =
        count === 1
          ? -Math.PI / 2
          : -Math.PI / 2 + (eIdx / count) * Math.PI * 2;
      const ringR = count === 1 ? 0 : orbitRadius * (eIdx % 2 === 0 ? 1 : 0.72);
      const x = Math.round((cx + Math.cos(angle) * ringR) * 10) / 10;
      const y = Math.round((cy + Math.sin(angle) * ringR * 0.85) * 10) / 10;

      const hasDecision = decisionEmailIds.has(email.email_id);
      const depthLayer = ((eIdx % 3) as 0 | 1 | 2);

      nodePosById.set(email.email_id, { x, y });
      nodes.push({
        email,
        threadKey: thread.thread_key,
        threadStatus: thread.status_class,
        x,
        y,
        hasDecision,
        depthLayer,
      });
    });

    // Build in_reply_to edges within loaded emails
    for (const email of threadEmails) {
      if (!email.in_reply_to) continue;
      const from = nodePosById.get(email.email_id);
      const to = nodePosById.get(email.in_reply_to);
      if (from && to) {
        edges.push({
          id: `${email.email_id}->${email.in_reply_to}`,
          fromX: from.x,
          fromY: from.y,
          toX: to.x,
          toY: to.y,
          threadKey: thread.thread_key,
        });
      }
    }
  });

  return {
    width,
    height,
    clusters,
    nodes,
    edges,
    decisionEmailIds,
  };
}
