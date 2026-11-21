import React, { useId } from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  description,
  id,
  className = '',
  ...rest
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <label
      htmlFor={inputId}
      className={`inline-flex items-start gap-2.5 cursor-pointer select-none min-h-[24px] ${className}`}
    >
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded-[4px] border border-[#7B8581] accent-[#102D2A] cursor-pointer"
        {...rest}
      />
      <span className="flex flex-col">
        <span className="text-[14px] text-[#202B35]">{label}</span>
        {description && <span className="text-[12px] text-[#5A6560]">{description}</span>}
      </span>
    </label>
  );
};
