import React from 'react';
import { RotateCw, ServerOff } from 'lucide-react';
import { env } from '../../config/env';
import type { HealthStatus } from '../../types/api';
import { Button } from './Button';

export interface ServiceUnavailableProps {
  baseUrl?: string;
  healthStatus?: HealthStatus | null;
  errorMessage?: string;
  requestId?: string;
  onRetry: () => void;
  onSwitchToDemo?: () => void;
  checking?: boolean;
  className?: string;
}

export const ServiceUnavailable: React.FC<ServiceUnavailableProps> = ({
  baseUrl = env.API_BASE_URL,
  healthStatus,
  errorMessage,
  requestId,
  onRetry,
  onSwitchToDemo,
  checking = false,
  className = '',
}) => {
  return (
    <section
      aria-label="Backend service unavailable"
      className={`rounded-[8px] border border-[#A3342B]/35 bg-white p-6 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-[#F9E4E1] text-[#A3342B]">
          <ServerOff size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[18px] font-semibold text-[#102D2A]">
            Live backend service is unavailable
          </h2>
          <p className="mt-1.5 text-[14px] leading-[1.55] text-[#202B35]">
            SUTRA is running in live mode and will not fall back to demo annotations automatically.
            {errorMessage ? ` ${errorMessage}` : ''}
          </p>

          <dl className="mt-4 grid gap-2 border-t border-b border-[#E5E2D9] py-3 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-[#5A6560]">Configured API base URL</dt>
              <dd className="mt-0.5 font-mono text-[12px] text-[#202B35] break-all">{baseUrl}</dd>
            </div>
            <div>
              <dt className="text-[#5A6560]">Health check result</dt>
              <dd className="mt-0.5 font-medium text-[#A3342B]">
                {healthStatus ? `status: ${healthStatus.status}` : 'Unreachable / no response'}
              </dd>
            </div>
            {requestId && (
              <div>
                <dt className="text-[#5A6560]">Request ID</dt>
                <dd className="mt-0.5 font-mono text-[12px] text-[#202B35] tabular-nums">
                  {requestId}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              loading={checking}
              onClick={onRetry}
              leftIcon={<RotateCw size={14} aria-hidden="true" />}
            >
              Retry connection
            </Button>
            {onSwitchToDemo && (
              <Button variant="secondary" size="sm" onClick={onSwitchToDemo}>
                Switch to Demo dataset
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
