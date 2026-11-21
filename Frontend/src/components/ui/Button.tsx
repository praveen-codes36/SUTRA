import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger-quiet';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[#102D2A] text-[#F5F2EA] border border-[#102D2A] hover:bg-[#1B4A45] hover:border-[#1B4A45]',
  secondary:
    'bg-white text-[#102D2A] border border-[#7B8581] hover:bg-[#E8EFEA] hover:border-[#102D2A]',
  ghost:
    'bg-transparent text-[#202B35] border border-transparent hover:bg-[#E8EFEA] hover:text-[#102D2A]',
  'danger-quiet':
    'bg-transparent text-[#A3342B] border border-[#A3342B]/40 hover:bg-[#F9E4E1] hover:border-[#A3342B]',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] lg:min-h-[36px] px-3 py-1.5 text-[13px] gap-1.5',
  md: 'min-h-[44px] lg:min-h-[40px] px-4 py-2 text-[14px] gap-2',
  lg: 'min-h-[44px] px-5 py-2.5 text-[15px] gap-2',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      leftIcon,
      rightIcon,
      className = '',
      children,
      type = 'button',
      ...rest
    },
    ref,
  ) => {
    const isDisabled = Boolean(disabled || loading);
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={`inline-flex items-center justify-center rounded-[4px] font-display font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
        {...rest}
      >
        {loading ? (
          <Loader2 size={15} className="animate-spin shrink-0" aria-hidden="true" />
        ) : (
          leftIcon && <span className="shrink-0 inline-flex">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!loading && rightIcon && <span className="shrink-0 inline-flex">{rightIcon}</span>}
      </button>
    );
  },
);

Button.displayName = 'Button';
