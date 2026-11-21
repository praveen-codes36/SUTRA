import React from 'react';
import { CheckCircle2, Circle, Loader2, MinusCircle, XCircle } from 'lucide-react';

export type StepStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'SKIPPED' | 'NOT_STARTED';

export interface StepItem {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

export interface StepperProps {
  steps: StepItem[];
  className?: string;
}

const STATUS_META: Record<StepStatus, { label: string; color: string; icon: React.ReactNode }> = {
  DONE: {
    label: 'Completed',
    color: 'text-[#1E6B45]',
    icon: <CheckCircle2 size={16} aria-hidden="true" />,
  },
  RUNNING: {
    label: 'Running',
    color: 'text-[#1F5A8A]',
    icon: <Loader2 size={16} className="animate-spin" aria-hidden="true" />,
  },
  FAILED: {
    label: 'Failed',
    color: 'text-[#A3342B]',
    icon: <XCircle size={16} aria-hidden="true" />,
  },
  SKIPPED: {
    label: 'Skipped',
    color: 'text-[#5A6560]',
    icon: <MinusCircle size={16} aria-hidden="true" />,
  },
  PENDING: {
    label: 'Pending',
    color: 'text-[#5A6560]',
    icon: <Circle size={16} aria-hidden="true" />,
  },
  NOT_STARTED: {
    label: 'Not started — requires the backend',
    color: 'text-[#5A6560]',
    icon: <Circle size={16} aria-hidden="true" />,
  },
};

export const Stepper: React.FC<StepperProps> = ({ steps, className = '' }) => {
  return (
    <ol className={`divide-y divide-[#E5E2D9] border border-[#E5E2D9] bg-white rounded-[4px] ${className}`}>
      {steps.map((step, index) => {
        const meta = STATUS_META[step.status];
        return (
          <li key={step.id} className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="flex items-start gap-3 min-w-0">
              <span className={`mt-0.5 shrink-0 ${meta.color}`}>{meta.icon}</span>
              <div className="min-w-0">
                <div className="font-display text-[14px] font-medium text-[#202B35]">
                  <span className="tabular-nums text-[#5A6560] mr-2">{index + 1}.</span>
                  {step.label}
                </div>
                {step.detail && (
                  <p className="mt-0.5 text-[12px] text-[#5A6560]">{step.detail}</p>
                )}
              </div>
            </div>
            <span className={`text-[12px] font-medium whitespace-nowrap shrink-0 ${meta.color}`}>
              {meta.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
};
