import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Scale } from 'lucide-react';
import { useSutra } from '../app/providers';
import type { EvaluationRun } from '../adapters/dataSource';
import { Badge } from '../components/ui/Badge';
import { Banner } from '../components/ui/Banner';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { Table, type TableColumn } from '../components/ui/Table';
import { DEMO_DATASET } from '../data/demoData';
import { usePrefs } from '../hooks/usePrefs';
import {
  OFFICIAL_EVALUATION_WEIGHTS,
  type OfficialEvaluationCriterion,
} from '../lib/csvPrecheck';
import { formatDateTime, formatUtcTooltip } from '../lib/format';
import { SutraApiError } from '../services/apiClient';
import { intelligenceService } from '../services/intelligenceService';

export const EvaluationPage: React.FC = () => {
  const { mode, dataSource } = useSutra();
  const { prefs } = usePrefs();
  const isDemo = mode === 'demo';

  const runsQuery = useQuery({
    queryKey: intelligenceService.keys.evaluationRuns(mode),
    queryFn: () => intelligenceService.listEvaluationRuns(dataSource),
    enabled: !isDemo,
  });

  const weightTotal = OFFICIAL_EVALUATION_WEIGHTS.reduce(
    (sum, item) => sum + item.weightPercent,
    0,
  );

  const weightColumns: Array<TableColumn<OfficialEvaluationCriterion>> = [
    {
      key: 'criterion',
      header: 'Evaluation criterion',
      render: (item) => (
        <div>
          <p className="font-display text-[13.5px] font-semibold text-[#102D2A]">{item.criterion}</p>
          <p className="mt-0.5 text-[12px] text-[#5A6560]">{item.notes}</p>
        </div>
      ),
    },
    {
      key: 'weight',
      header: 'Weight',
      align: 'right',
      widthClass: 'w-[120px]',
      render: (item) => (
        <span className="font-mono text-[14px] font-semibold text-[#102D2A] tabular-nums">
          {item.weightPercent}%
        </span>
      ),
    },
  ];

  const runColumns: Array<TableColumn<EvaluationRun>> = [
    {
      key: 'run_id',
      header: 'Run ID',
      render: (run) => (
        <span className="font-mono text-[12.5px] font-semibold text-[#102D2A] tabular-nums">
          {run.run_id}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (run) => (
        <span title={formatUtcTooltip(run.created_at)} className="tabular-nums text-[12.5px] text-[#5A6560]">
          {formatDateTime(run.created_at, { showUtc: prefs.showUtc })}
        </span>
      ),
    },
    {
      key: 'dataset_name',
      header: 'Dataset',
      render: (run) => <span className="text-[13px] text-[#202B35]">{run.dataset_name || 'Not reported'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (run) => <Badge label={run.status} tone="info" />,
    },
    {
      key: 'scores',
      header: 'Reported scores',
      render: (run) => {
        if (!run.scores || Object.keys(run.scores).length === 0) {
          return <span className="text-[12.5px] text-[#5A6560]">Not reported</span>;
        }
        return (
          <div className="flex flex-wrap gap-2">
            {Object.entries(run.scores).map(([k, v]) => (
              <span
                key={k}
                className="rounded-[4px] border border-[#E5E2D9] bg-[#F5F2EA] px-2 py-0.5 font-mono text-[11.5px] text-[#102D2A] tabular-nums"
              >
                {k}: {v}
              </span>
            ))}
          </div>
        );
      },
    },
  ];

  const isEndpointMissing =
    runsQuery.error instanceof SutraApiError && runsQuery.error.code === 'NOT_FOUND';

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <div className="border-b border-[#E5E2D9] pb-4">
        <h1 className="font-display text-[22px] font-semibold text-[#102D2A]">Evaluation</h1>
        <p className="mt-1 text-[14px] text-[#5A6560]">
          Official SUTRA benchmark evaluation criteria weights and backend evaluation run records.
        </p>
      </div>

      {/* Official criteria weights */}
      <section aria-label="Official evaluation weights" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[16px] font-semibold text-[#102D2A]">
            Official evaluation rubric
          </h2>
          <span className="font-mono text-[12px] font-semibold text-[#7A5C1E] tabular-nums">
            Total weight: {weightTotal}%
          </span>
        </div>

        <Table
          caption="Official SUTRA evaluation criteria and weights"
          columns={weightColumns}
          rows={OFFICIAL_EVALUATION_WEIGHTS}
          rowKey={(item) => item.id}
        />
      </section>

      {/* Evaluation runs */}
      <section aria-label="Evaluation runs" className="space-y-3">
        <h2 className="font-display text-[16px] font-semibold text-[#102D2A]">
          Evaluation runs
        </h2>

        {isDemo ? (
          <Banner tone="demo" title="No evaluation runs in demo mode.">
            The supplied synthetic benchmark includes {DEMO_DATASET.meta.counts.evaluation_cases} evaluation test cases for backend evaluation, and no fabricated scores are shown in the browser. Connect to a live backend with evaluation enabled to view recorded runs.
          </Banner>
        ) : runsQuery.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : isEndpointMissing ? (
          <EmptyState
            title="Evaluation runs endpoint not available"
            description="This backend deployment does not expose evaluation run records at GET /evaluation/runs."
            icon={<Scale size={20} aria-hidden="true" />}
          />
        ) : runsQuery.error ? (
          <ErrorState
            title="Unable to load evaluation runs"
            message={
              runsQuery.error instanceof Error
                ? runsQuery.error.message
                : 'Failed to retrieve evaluation runs.'
            }
            requestId={
              runsQuery.error instanceof SutraApiError ? runsQuery.error.requestId : undefined
            }
            onRetry={() => void runsQuery.refetch()}
          />
        ) : (runsQuery.data || []).length === 0 ? (
          <EmptyState
            title="No evaluation runs recorded"
            description="The backend returned zero evaluation runs."
            icon={<Scale size={20} aria-hidden="true" />}
          />
        ) : (
          <Table
            caption="Backend evaluation runs"
            columns={runColumns}
            rows={runsQuery.data || []}
            rowKey={(run) => run.run_id}
          />
        )}
      </section>
    </div>
  );
};

export default EvaluationPage;
