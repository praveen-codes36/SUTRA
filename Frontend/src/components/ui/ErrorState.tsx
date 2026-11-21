import React from 'react';
import { AlertCircle, RotateCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  requestId?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Unable to load records',
  message,
  requestId,
  onRetry,
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`rounded-[8px] border border-[#A3342B]/30 bg-[#F9E4E1] px-5 py-4 text-[#A3342B] ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[15px] font-semibold text-[#A3342B]">{title}</h2>
          <p className="mt-1 text-[14px] leading-[1.5] text-[#202B35]">{message}</p>
          {requestId && (
            <p className="mt-1.5 font-mono text-[12px] text-[#5A6560] tabular-nums">
              Request ID: {requestId}
            </p>
          )}
          {onRetry && (
            <div className="mt-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={onRetry}
                leftIcon={<RotateCw size={14} aria-hidden="true" />}
              >
                Retry
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
