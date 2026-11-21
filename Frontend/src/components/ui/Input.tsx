import React, { useId } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, id, wrapperClassName = '', className = '', ...rest }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

    return (
      <div className={`flex flex-col gap-1.5 ${wrapperClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-[13px] font-medium text-[#202B35] font-display"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`min-h-[44px] lg:min-h-[40px] w-full rounded-[4px] bg-white px-3 py-2 text-[14px] text-[#202B35] placeholder:text-[#5A6560] border ${
            error ? 'border-[#A3342B]' : 'border-[#7B8581]'
          } focus:border-[#102D2A] disabled:bg-[#F5F2EA] disabled:text-[#5A6560] ${className}`}
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

Input.displayName = 'Input';
