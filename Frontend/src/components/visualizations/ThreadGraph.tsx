import React, { useMemo, useState } from 'react';
import { formatDateTime } from '../../lib/format';
import type { ActionItem, Decision, EmailMessage, ThreadDetail } from '../../types/api';
import { buildThreadGraph } from './threadGraphLayout';

export interface ThreadGraphProps {
  thread: ThreadDetail | undefined;
  emails: EmailMessage[];
  decisions: Decision[];
  actions: ActionItem[];
  selectedEmailId: string | null;
  showUtc?: boolean;
  onSelectEmail: (emailId: string) => void;
}

export const ThreadGraph: React.FC<ThreadGraphProps> = ({
  thread,
  emails,
  decisions,
  actions,
  selectedEmailId,
  showUtc = false,
  onSelectEmail,
}) => {
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const graph = useMemo(
    () => buildThreadGraph(thread, emails, decisions, actions),
    [thread, emails, decisions, actions],
  );

  if (graph.nodes.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Conversation relationship graph"
      className="min-w-0 w-full max-w-full overflow-hidden rounded-[8px] border border-[#E5E2D9] bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E2D9] pb-3.5">
        <div>
          <h2 className="font-display text-[16px] font-semibold text-[#102D2A]">
            Conversation chronology &amp; reply graph
          </h2>
          <p className="mt-0.5 text-[13px] text-[#5A6560]">
            Ordinal chronological sequence ({graph.nodes.length} messages) with directed reply arcs (child → parent). Select any node to scroll to and focus that message.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-[#202B35]">
          <span className="inline-flex items-center gap-1.5 font-medium text-[#7A5C1E]">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded-full border-2 border-[#D5B77B] bg-white"
            />
            <span>Decision</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-[#1F5A8A]" />
            <span>Action item</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-[#1E6B45]" />
            <span>Attachment</span>
          </span>
        </div>
      </div>

      <div className="mt-4 w-full max-w-full overflow-x-auto rounded-[6px] border border-[#E5E2D9] bg-[#F5F2EA]/40">
        <svg
          viewBox={`0 0 ${graph.width} ${graph.height}`}
          role="img"
          aria-label={`Chronological reply graph for ${thread?.thread_key || 'conversation'} with ${graph.nodes.length} messages`}
          className="block h-auto min-w-[680px] w-full"
        >
          <defs>
            <marker
              id="sutra-reply-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#7B8581" />
            </marker>
          </defs>

          {/* Horizontal chronological segments and large-gap annotations */}
          {graph.nodes.map((node, idx) => {
            if (idx === 0) return null;
            const prev = graph.nodes[idx - 1];
            const gap = graph.gaps.find(
              (g) => g.fromEmailId === prev.email.email_id && g.toEmailId === node.email.email_id,
            );
            return (
              <g key={`seg-${prev.email.email_id}-${node.email.email_id}`}>
                <line
                  x1={prev.x + 14}
                  y1={graph.spineY}
                  x2={node.x - 14}
                  y2={graph.spineY}
                  stroke={gap ? '#8A5A00' : '#E5E2D9'}
                  strokeWidth={gap ? '1.8' : '2'}
                  strokeDasharray={gap ? '4 4' : undefined}
                />
                {gap && (
                  <g data-testid={`thread-gap-${gap.fromEmailId}-${gap.toEmailId}`}>
                    <rect
                      x={gap.midX - 46}
                      y={graph.spineY + 12}
                      width="92"
                      height="20"
                      rx="4"
                      fill="#FBF0D9"
                      stroke="#8A5A00"
                      strokeOpacity="0.45"
                    />
                    <text
                      x={gap.midX}
                      y={graph.spineY + 25}
                      textAnchor="middle"
                      fill="#8A5A00"
                      fontSize="10.5"
                      fontWeight="600"
                      fontFamily="Inter, sans-serif"
                    >
                      {gap.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Directed reply arcs (child -> parent) */}
          {graph.arcs.map((arc) => {
            const midX = (arc.fromX + arc.toX) / 2;
            const controlY = arc.y - arc.arcHeight;
            return (
              <path
                key={arc.id}
                d={`M ${arc.fromX} ${arc.y - 12} Q ${midX} ${controlY} ${arc.toX + 8} ${arc.y - 12}`}
                fill="none"
                stroke={arc.anomaly ? '#A3342B' : '#7B8581'}
                strokeWidth="1.4"
                strokeOpacity="0.85"
                strokeDasharray={arc.anomaly ? '3 3' : undefined}
                markerEnd="url(#sutra-reply-arrow)"
              />
            );
          })}

          {/* Message nodes */}
          {graph.nodes.map((node) => {
            const isSelected = selectedEmailId === node.email.email_id;
            const isFocused = focusedId === node.email.email_id;
            const roleLabel = node.email.sender.role || node.email.sender.address;
            const timeLabel = formatDateTime(node.email.timestamp, { showUtc });
            const shortDate = timeLabel.split(',')[0] || timeLabel;
            const shortTime = timeLabel.split(',')[1]?.trim() || '';

            const ariaParts = [
              node.email.email_id,
              roleLabel,
              timeLabel,
              node.hasDecision ? `${node.decisionCount} decision` : null,
              node.actionCount > 0 ? `${node.actionCount} action` : null,
              node.attachmentCount > 0 ? `${node.attachmentCount} attachment` : null,
            ].filter(Boolean);

            return (
              <g
                key={node.email.email_id}
                data-testid={`thread-graph-node-${node.email.email_id}`}
                transform={`translate(${node.x}, ${node.y})`}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`${ariaParts.join(', ')}. Activate to scroll to message.`}
                className="cursor-pointer focus:outline-none"
                onClick={() => onSelectEmail(node.email.email_id)}
                onFocus={() => setFocusedId(node.email.email_id)}
                onBlur={() => setFocusedId((prev) => (prev === node.email.email_id ? null : prev))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectEmail(node.email.email_id);
                  }
                }}
              >
                {isFocused && (
                  <circle
                    r={18}
                    fill="none"
                    stroke="#102D2A"
                    strokeWidth="2"
                    strokeDasharray="2 2"
                  />
                )}
                {node.hasDecision && (
                  <circle
                    r={14}
                    fill="#FBF0D9"
                    fillOpacity="0.65"
                    stroke="#D5B77B"
                    strokeWidth="2.4"
                  />
                )}
                <circle
                  r={isSelected ? 10 : 8.5}
                  fill={isSelected ? '#102D2A' : '#FFFFFF'}
                  stroke="#102D2A"
                  strokeWidth={isSelected ? '2.5' : '1.8'}
                />
                {isSelected && <circle r={3.5} fill="#D5B77B" />}

                {/* Indicator dots above/around node for action & attachment */}
                {node.actionCount > 0 && (
                  <circle cx={11} cy={-9} r={3.6} fill="#1F5A8A" stroke="#FFFFFF" strokeWidth="1" />
                )}
                {node.attachmentCount > 0 && (
                  <circle cx={-11} cy={-9} r={3.6} fill="#1E6B45" stroke="#FFFFFF" strokeWidth="1" />
                )}

                {/* Node labels */}
                <text
                  y={28}
                  textAnchor="middle"
                  fill="#102D2A"
                  fontSize="12"
                  fontWeight="700"
                  fontFamily="Manrope, sans-serif"
                >
                  {node.email.email_id}
                </text>
                <text
                  y={44}
                  textAnchor="middle"
                  fill="#202B35"
                  fontSize="10.5"
                  fontWeight="500"
                  fontFamily="Inter, sans-serif"
                >
                  {roleLabel.length > 22 ? `${roleLabel.slice(0, 20)}…` : roleLabel}
                </text>
                <text
                  y={58}
                  textAnchor="middle"
                  fill="#5A6560"
                  fontSize="10"
                  fontFamily="Inter, sans-serif"
                >
                  {shortDate}
                </text>
                {shortTime && (
                  <text
                    y={71}
                    textAnchor="middle"
                    fill="#5A6560"
                    fontSize="9.5"
                    fontFamily="Inter, sans-serif"
                  >
                    {shortTime}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
};
