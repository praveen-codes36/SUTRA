import React from 'react';

export interface LogoProps {
  variant?: 'onLight' | 'onDark';
  size?: number;
  className?: string;
  decorative?: boolean;
  label?: string;
}

export const Logo: React.FC<LogoProps> = ({
  variant = 'onLight',
  size = 32,
  className = '',
  decorative = true,
  label = 'SUTRA logo mark',
}) => {
  const isDark = variant === 'onDark';
  const strokeColor = isDark ? '#D5B77B' : '#102D2A';
  const endNodeFill = isDark ? '#F5F2EA' : '#102D2A';
  const centerNodeStroke = isDark ? '#F5F2EA' : '#102D2A';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden={decorative ? 'true' : undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
    >
      <path
        d="M8 38 C8 27 20 31 24 24 C28 17 39 21 40 10"
        stroke={strokeColor}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="8" cy="38" r="3" fill={endNodeFill} />
      <circle cx="40" cy="10" r="3" fill={endNodeFill} />
      <circle
        cx="24"
        cy="24"
        r="4.6"
        fill="#D5B77B"
        stroke={centerNodeStroke}
        strokeWidth="1.6"
      />
    </svg>
  );
};
