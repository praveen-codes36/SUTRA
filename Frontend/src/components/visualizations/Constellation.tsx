import React, { useMemo, useState } from 'react';
import { useCapability } from '../../hooks/useCapability';
import { formatDateTime } from '../../lib/format';
import { THREAD_STATUS_META } from '../../lib/semantics';
import type {
  Decision,
  EmailMessage,
  ThreadListItem,
  ThreadStatusClass,
} from '../../types/api';
import { Badge, StatusPill } from '../ui/Badge';
import { RolePill } from '../ui/RolePill';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Table, type TableColumn } from '../ui/Table';
import {
  buildConstellationGraph,
  type ConstellationNode,
} from './constellationLayout';

const STATUS_FILL_COLOR: Record<ThreadStatusClass, string> = {
  OPEN: '#102D2A',
  AWAITING_ACTION: '#8A5A00',
  PARTIALLY_COMPLETE: '#1F5A8A',
  MONITORING: '#7A5C1E',
  COMPLETED: '#1E6B45',
  UNKNOWN: '#5A6560',
};

export interface ConstellationProps {
  threads: ThreadListItem[];
  emails: EmailMessage[];
  decisions: Decision[];
  showUtc?: boolean;
  onSelectEmail: (emailId: string) => void;
}

export const Constellation: React.FC<ConstellationProps> = ({
  threads,
  emails,
  decisions,
  showUtc = false,
  onSelectEmail,
}) => {
  const { reducedMotion } = useCapability();
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [hoveredNode, setHoveredNode] = useState<ConstellationNode | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  const graph = useMemo(
    () => buildConstellationGraph(threads, emails, decisions),
    [threads, emails, decisions],
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    setParallax({ x: nx * 5, y: ny * 4 });
  };

  const listColumns: Array<TableColumn<ConstellationNode>> = [
    {
      key: 'email_id',
      header: 'Email',
      sortable: false,
      render: (row) => (
        <span className="font-mono text-[12.5px] font-semibold text-[#102D2A] tabular-nums">
          {row.email.email_id}
        </span>
      ),
    },
    {
      key: 'thread',
      header: 'Conversation',
      render: (row) => (
        <span className="font-mono text-[12px] text-[#5A6560] tabular-nums">
          {row.threadKey}
        </span>
      ),
    },
    {
      key: 'sender',
      header: 'Sender role',
      render: (row) => <RolePill person={row.email.sender} />,
    },
    {
      key: 'sent',
      header: 'Sent time',
      render: (row) => (
        <span className="text-[12.5px] text-[#5A6560] tabular-nums">
          {formatDateTime(row.email.timestamp, { showUtc })}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Thread status',
      render: (row) => {
        const meta = THREAD_STATUS_META[row.threadStatus];
        return <StatusPill label={meta.label} tone={meta.tone} icon={meta.icon} />;
      },
    },
    {
      key: 'decision',
      header: 'Decision evidence',
      render: (row) =>
        row.hasDecision ? (
          <Badge label="Carries decision" tone="warning" icon="ShieldCheck" />
        ) : (
          <span className="text-[12px] text-[#5A6560]">—</span>
        ),
    },
  ];

  return (
    <section
      aria-label="Intelligence constellation"
      className="rounded-[8px] border border-[#E5E2D9] bg-white p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E5E2D9] pb-4">
        <div>
          <h2 className="font-display text-[16px] font-semibold text-[#102D2A]">
            Intelligence constellation
          </h2>
          <p className="mt-1 text-[13px] text-[#5A6560]">
            Computed from loaded conversations ({threads.length}), messages ({emails.length}), and decision citations ({graph.decisionEmailIds.size} linked emails).
          </p>
        </div>
        <SegmentedControl
          ariaLabel="Constellation display mode"
          value={viewMode}
          onChange={(v) => setViewMode(v as 'map' | 'list')}
          options={[
            { value: 'map', label: 'Constellation' },
            { value: 'list', label: 'View as list' },
          ]}
        />
      </div>

      {/* Always-visible legend */}
      <div
        className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[4px] border border-[#E5E2D9] bg-[#F5F2EA]/60 px-3 py-2 text-[12px] text-[#202B35]"
        aria-label="Constellation legend"
      >
        {(Object.keys(THREAD_STATUS_META) as ThreadStatusClass[]).map((statusKey) => (
          <span key={statusKey} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: STATUS_FILL_COLOR[statusKey] }}
            />
            <span>{THREAD_STATUS_META[statusKey].label}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 font-medium text-[#7A5C1E]">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-full border-2 border-[#D5B77B] bg-white"
          />
          <span>Gold ring = carries decision evidence</span>
        </span>
      </div>

      {graph.nodes.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-[#5A6560]">
          No visible emails or conversation clusters to map.
        </p>
      ) : viewMode === 'list' ? (
        <div className="mt-4">
          <Table
            caption="Constellation nodes as accessible table"
            columns={listColumns}
            rows={graph.nodes}
            rowKey={(r) => r.email.email_id}
            onRowClick={(r) => onSelectEmail(r.email.email_id)}
          />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setParallax({ x: 0, y: 0 })}
            className="relative overflow-x-auto rounded-[6px] border border-[#E5E2D9] bg-[#F5F2EA]/40"
          >
            <svg
              viewBox={`0 0 ${graph.width} ${graph.height}`}
              role="img"
              aria-label={`Interactive constellation of ${graph.nodes.length} emails grouped across ${graph.clusters.length} conversations`}
              className="block h-auto min-w-[680px] w-full"
            >
              {/* Cluster circles and labels */}
              {graph.clusters.map((cluster) => (
                <g key={cluster.thread.thread_key}>
                  <circle
                    cx={cluster.cx}
                    cy={cluster.cy}
                    r={cluster.radius}
                    fill="#FFFFFF"
                    fillOpacity="0.72"
                    stroke="#E5E2D9"
                    strokeWidth="1.2"
                  />
                  <text
                    x={cluster.cx}
                    y={cluster.cy + cluster.radius + 14}
                    textAnchor="middle"
                    fill="#102D2A"
                    fontSize="11"
                    fontWeight="600"
                    fontFamily="Manrope, sans-serif"
                  >
                    {cluster.thread.thread_key}
                  </text>
                  <text
                    x={cluster.cx}
                    y={cluster.cy + cluster.radius + 27}
                    textAnchor="middle"
                    fill="#5A6560"
                    fontSize="10"
                    fontFamily="Inter, sans-serif"
                  >
                    {(cluster.thread.title || 'Untitled').slice(0, 26)}
                    {(cluster.thread.title || '').length > 26 ? '…' : ''}
                  </text>
                </g>
              ))}

              {/* in_reply_to edges */}
              {graph.edges.map((edge) => {
                const mx = (edge.fromX + edge.toX) / 2;
                const my = (edge.fromY + edge.toY) / 2 - 8;
                return (
                  <path
                    key={edge.id}
                    d={`M ${edge.fromX} ${edge.fromY} Q ${mx} ${my} ${edge.toX} ${edge.toY}`}
                    fill="none"
                    stroke="#7B8581"
                    strokeOpacity="0.6"
                    strokeWidth="1.2"
                  />
                );
              })}

              {/* Email nodes (keyboard-accessible buttons) */}
              {graph.nodes.map((node) => {
                const shiftX = reducedMotion ? 0 : parallax.x * (node.depthLayer * 0.45);
                const shiftY = reducedMotion ? 0 : parallax.y * (node.depthLayer * 0.45);
                const fill = STATUS_FILL_COLOR[node.threadStatus];
                const isActive = hoveredNode?.email.email_id === node.email.email_id;
                const roleName = node.email.sender.role || node.email.sender.address;
                const timeStr = formatDateTime(node.email.timestamp, { showUtc });
                const ariaLabel = `${node.email.email_id}, thread ${node.threadKey}, ${roleName}, ${timeStr}${
                  node.hasDecision ? ', carries decision evidence' : ''
                }. Activate to inspect evidence.`;

                return (
                  <g
                    key={node.email.email_id}
                    data-testid={`constellation-node-${node.email.email_id}`}
                    transform={`translate(${node.x + shiftX}, ${node.y + shiftY})`}
                    role="button"
                    tabIndex={0}
                    aria-label={ariaLabel}
                    className="cursor-pointer focus:outline-none"
                    onClick={() => onSelectEmail(node.email.email_id)}
                    onMouseEnter={() => setHoveredNode(node)}
                    onFocus={() => {
                      setFocusedId(node.email.email_id);
                      setHoveredNode(node);
                    }}
                    onBlur={() => {
                      setFocusedId((prev) => (prev === node.email.email_id ? null : prev));
                      setHoveredNode((prev) =>
                        prev?.email.email_id === node.email.email_id ? null : prev,
                      );
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectEmail(node.email.email_id);
                      }
                    }}
                  >
                    {focusedId === node.email.email_id && (
                      <circle
                        r={13.5}
                        fill="none"
                        stroke="#102D2A"
                        strokeWidth="2"
                        strokeDasharray="2 2"
                      />
                    )}
                    {node.hasDecision && (
                      <circle
                        r={isActive ? 10.5 : 9}
                        fill="none"
                        stroke="#D5B77B"
                        strokeWidth="2.4"
                      />
                    )}
                    <circle
                      r={isActive ? 6.5 : 5.5}
                      fill={fill}
                      stroke="#FFFFFF"
                      strokeWidth="1.4"
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Persistent hover/focus readout bar */}
          <div
            aria-live="polite"
            className="flex min-h-[38px] flex-wrap items-center justify-between gap-2 rounded-[4px] border border-[#E5E2D9] bg-[#F5F2EA]/70 px-3.5 py-2 text-[12.5px] text-[#202B35]"
          >
            {hoveredNode ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold text-[#102D2A] tabular-nums">
                    {hoveredNode.email.email_id}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium">
                    {hoveredNode.email.sender.role || hoveredNode.email.sender.address}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#5A6560] tabular-nums">
                    {formatDateTime(hoveredNode.email.timestamp, { showUtc })}
                  </span>
                </div>
                {hoveredNode.hasDecision && (
                  <Badge label="Carries decision" tone="warning" icon="ShieldCheck" />
                )}
              </>
            ) : (
              <span className="text-[#5A6560]">
                Hover or focus any message node to inspect metadata; click or press Enter to open the Evidence drawer.
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
