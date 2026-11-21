import React, { useId } from 'react';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className = '',
}) => {
  const id = useId();
  const descId = description ? `${id}-desc` : undefined;

  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="flex flex-col">
        <label htmlFor={id} className="text-[14px] font-medium text-[#202B35] cursor-pointer">
          {label}
        </label>
        {description && (
          <span id={descId} className="text-[12px] text-[#5A6560] mt-0.5">
            {description}
          </span>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={descId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
          checked
            ? 'bg-[#102D2A] border-[#102D2A]'
            : 'bg-[#E5E2D9] border-[#7B8581]'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform duration-150 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
};
