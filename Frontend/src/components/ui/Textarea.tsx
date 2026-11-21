import React, { useId } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, id, wrapperClassName = '', className = '', rows = 4, ...rest }, ref) => {
    const generatedId = useId();
    const areaId = id || generatedId;
    const hintId = hint ? `${areaId}-hint` : undefined;
    const errorId = error ? `${areaId}-error` : undefined;

    return (
      <div className={`flex flex-col gap-1.5 ${wrapperClassName}`}>
        {label && (
          <label htmlFor={areaId} className="text-[13px] font-medium text-[#202B35] font-display">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
          className={`w-full rounded-[4px] bg-white px-3 py-2.5 text-[14px] leading-[1.55] text-[#202B35] placeholder:text-[#5A6560] border ${
            error ? 'border-[#A3342B]' : 'border-[#7B8581]'
          } focus:border-[#102D2A] disabled:bg-[#F5F2EA] ${className}`}
          {...rest}
        />
        {hint && !error && (
          <p id={hintId} className="text-[12px] text-[#5A6560]">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-[12px] font-medium text-[#A3342B]">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
