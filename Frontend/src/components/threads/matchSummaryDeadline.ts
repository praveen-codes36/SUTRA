import type { ActionItem, CitedStatement, DeadlineState } from '../../types/api';

const STATE_HINTS: Array<{ pattern: RegExp; state: DeadlineState }> = [
  { pattern: /\bmet\b/i, state: 'MET' },
  { pattern: /\boverdue\b/i, state: 'OVERDUE' },
  { pattern: /\bmissed\b/i, state: 'MISSED' },
  { pattern: /\bupcoming\b/i, state: 'UPCOMING' },
  { pattern: /\bno deadline\b/i, state: 'NONE' },
];

function extractSignificantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4),
  );
}

/**
 * Matches a summary deadline line against the thread's extracted ActionItems
 * by combining evidence/completion email overlap, explicit outcome hints,
 * deadline text overlap, and task token similarity.
 */
export function matchSummaryDeadlineAction(
  deadline: CitedStatement,
  actions: ActionItem[],
): ActionItem | undefined {
  if (actions.length === 0) return undefined;

  const dlTextLower = deadline.text.toLowerCase();
  const dlWords = extractSignificantWords(deadline.text);

  let bestAction: ActionItem | undefined;
  let bestScore = 0;

  for (const action of actions) {
    const sourceIds = new Set(action.evidence.map((ev) => ev.email_id));
    const allIds = new Set([
      ...sourceIds,
      ...action.completion_evidence.map((ev) => ev.email_id),
    ]);

    let overlapCount = 0;
    for (const eid of deadline.email_ids) {
      if (allIds.has(eid)) overlapCount += 1;
    }

    if (overlapCount === 0) continue;

    let score = overlapCount * 10;

    if (deadline.email_ids[0] && sourceIds.has(deadline.email_ids[0])) {
      score += 15;
    }

    if (
      action.deadline.text &&
      dlTextLower.includes(action.deadline.text.trim().toLowerCase())
    ) {
      score += 20;
    }

    for (const hint of STATE_HINTS) {
      if (hint.pattern.test(deadline.text) && action.deadline_state === hint.state) {
        score += 18;
      }
    }

    const taskWords = extractSignificantWords(action.task);
    for (const w of taskWords) {
      if (dlWords.has(w)) {
        score += 3;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }

  return bestAction;
}
