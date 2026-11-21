import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'default' | 'ghost' | 'dark';
  size?: 'sm' | 'md';
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, variant = 'ghost', size = 'md', className = '', children, type = 'button', ...rest }, ref) => {
    const sizeClass =
      size === 'sm'
        ? 'min-h-[44px] min-w-[44px] lg:h-9 lg:w-9 lg:min-h-[36px] lg:min-w-[36px]'
        : 'h-11 w-11 min-h-[44px] min-w-[44px]';
    const variantClass =
      variant === 'dark'
        ? 'text-[#F5F2EA] hover:bg-[#1B4A45]'
        : variant === 'default'
          ? 'bg-white text-[#102D2A] border border-[#7B8581] hover:bg-[#E8EFEA]'
          : 'text-[#202B35] hover:bg-[#E8EFEA] hover:text-[#102D2A]';

    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={rest.title ?? label}
        className={`inline-flex items-center justify-center rounded-[4px] shrink-0 transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sizeClass} ${variantClass} ${className}`}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';
