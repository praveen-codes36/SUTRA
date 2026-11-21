import React from 'react';
import { Link } from 'react-router-dom';
import { formatDateShort } from '../../lib/format';
import {
  ACTION_STATUS_META,
  DECISION_STATUS_META,
  DECISION_TYPE_META,
  getThreadCategoryLabel,
} from '../../lib/semantics';
import type { TopicItem } from '../../adapters/dataSource';
import type {
  ActionItem,
  ActionStatus,
  Decision,
  DecisionStatus,
  DecisionType,
} from '../../types/api';
import { Badge } from '../ui/Badge';

export interface OverviewAnalyticsProps {
  decisions: Decision[];
  actions: ActionItem[];
  topics: TopicItem[];
  showUtc?: boolean;
}

export const OverviewAnalytics: React.FC<OverviewAnalyticsProps> = ({
  decisions,
  actions,
  topics,
  showUtc = false,
}) => {
  const decisionsByType = (Object.keys(DECISION_TYPE_META) as DecisionType[])
    .map((type) => ({
      type,
      meta: DECISION_TYPE_META[type],
      count: decisions.filter((d) => d.type === type).length,
    }))
    .filter((item) => item.count > 0);

  const decisionsByStatus = (Object.keys(DECISION_STATUS_META) as DecisionStatus[])
    .map((status) => ({
      status,
      meta: DECISION_STATUS_META[status],
      count: decisions.filter((d) => d.status === status).length,
    }))
    .filter((item) => item.count > 0);

  const actionsByStatus = (Object.keys(ACTION_STATUS_META) as ActionStatus[])
    .map((status) => ({
      status,
      meta: ACTION_STATUS_META[status],
      count: actions.filter((a) => a.status === status).length,
    }))
    .filter((item) => item.count > 0);

  const unreportedStatuses: string[] = [];
  if (!actions.some((a) => a.status === 'IN_PROGRESS')) {
    unreportedStatuses.push('In progress');
  }
  if (!actions.some((a) => a.status === 'BLOCKED')) {
    unreportedStatuses.push('Blocked');
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* Decisions breakdown */}
      <section className="rounded-[8px] border border-[#E5E2D9] bg-white p-5">
        <div className="flex items-baseline justify-between gap-2 border-b border-[#E5E2D9] pb-2.5">
          <h2 className="font-display text-[15px] font-semibold text-[#102D2A]">
            Decisions by type &amp; status
          </h2>
          <Link
            to="/app/decisions"
            className="text-[12px] font-medium text-[#102D2A] hover:underline"
          >
            Open ledger
          </Link>
        </div>

        {decisions.length === 0 ? (
          <p className="py-5 text-[13px] text-[#5A6560]">No decisions identified yet.</p>
        ) : (
          <div className="mt-3 space-y-4">
            <ul className="space-y-2 text-[13px]">
              {decisionsByType.map(({ type, meta, count }) => (
                <li key={type} className="flex items-center justify-between gap-2">
                  <Link
                    to={`/app/decisions?type=${encodeURIComponent(type)}`}
                    className="hover:underline"
                  >
                    <Badge label={meta.label} tone={meta.tone} icon={meta.icon} />
                  </Link>
                  <span className="font-mono font-semibold text-[#102D2A] tabular-nums">
                    {count}
                  </span>
                </li>
              ))}
            </ul>

            <div className="border-t border-[#E5E2D9] pt-3">
              <p className="mb-2 font-display text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
                By status
              </p>
              <div className="flex flex-wrap gap-2">
                {decisionsByStatus.map(({ status, meta, count }) => (
                  <Link
                    key={status}
                    to={`/app/decisions?status=${encodeURIComponent(status)}`}
                    className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#E5E2D9] bg-[#F5F2EA]/60 px-2.5 py-1 text-[12px] hover:border-[#102D2A]"
                  >
                    <span className="text-[#202B35]">{meta.label}</span>
                    <span className="font-mono font-semibold text-[#102D2A] tabular-nums">
                      {count}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Actions breakdown */}
      <section className="rounded-[8px] border border-[#E5E2D9] bg-white p-5">
        <div className="flex items-baseline justify-between gap-2 border-b border-[#E5E2D9] pb-2.5">
          <h2 className="font-display text-[15px] font-semibold text-[#102D2A]">
            Action items by status
          </h2>
          <Link
            to="/app/actions"
            className="text-[12px] font-medium text-[#102D2A] hover:underline"
          >
            Action tracker
          </Link>
        </div>

        {actions.length === 0 ? (
          <p className="py-5 text-[13px] text-[#5A6560]">No action items extracted yet.</p>
        ) : (
          <div className="mt-3 space-y-4">
            <ul className="space-y-2 text-[13px]">
              {actionsByStatus.map(({ status, meta, count }) => (
                <li key={status} className="flex items-center justify-between gap-2">
                  <Link
                    to={`/app/actions?status=${encodeURIComponent(status)}`}
                    className="hover:underline"
                  >
                    <Badge label={meta.label} tone={meta.tone} icon={meta.icon} />
                  </Link>
                  <span className="font-mono font-semibold text-[#102D2A] tabular-nums">
                    {count}
                  </span>
                </li>
              ))}
            </ul>
            {unreportedStatuses.length > 0 && (
              <p className="border-t border-[#E5E2D9] pt-2.5 text-[12px] text-[#5A6560]">
                {unreportedStatuses.join(' / ')}: Not reported in loaded records.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Recently discussed topics */}
      <section className="rounded-[8px] border border-[#E5E2D9] bg-white p-5">
        <div className="flex items-baseline justify-between gap-2 border-b border-[#E5E2D9] pb-2.5">
          <h2 className="font-display text-[15px] font-semibold text-[#102D2A]">
            Recently discussed topics
          </h2>
          <Link
            to="/app/threads"
            className="text-[12px] font-medium text-[#102D2A] hover:underline"
          >
            All threads
          </Link>
        </div>

        {topics.length === 0 ? (
          <p className="py-5 text-[13px] text-[#5A6560]">No topics available.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[#E5E2D9] text-[13px]">
            {topics.slice(0, 6).map((topic) => (
              <li
                key={topic.category}
                className="flex items-center justify-between gap-2 py-2.5"
              >
                <div className="min-w-0">
                  <Link
                    to={`/app/threads?category=${encodeURIComponent(topic.category)}`}
                    className="font-medium text-[#102D2A] hover:underline"
                  >
                    {getThreadCategoryLabel(topic.category)}
                  </Link>
                  <p className="text-[11.5px] text-[#5A6560] tabular-nums">
                    Last activity {formatDateShort(topic.last_activity_at, { showUtc })}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[12px] font-semibold text-[#5A6560] tabular-nums">
                  {topic.thread_count} {topic.thread_count === 1 ? 'thread' : 'threads'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
