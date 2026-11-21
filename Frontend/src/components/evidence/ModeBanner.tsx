import React from 'react';
import { Link } from 'react-router-dom';
import { env } from '../../config/env';
import { Banner } from '../ui/Banner';

export interface ModeBannerProps {
  personaLabel?: string;
}

export const ModeBanner: React.FC<ModeBannerProps> = ({ personaLabel }) => {
  return (
    <Banner
      tone="demo"
      className="border-x-0 border-t-0"
      action={
        env.ALLOW_MODE_SWITCH ? (
          <Link
            to="/app/settings"
            className="text-[12px] font-semibold text-[#102D2A] underline hover:text-[#1B4A45] whitespace-nowrap"
          >
            Data mode settings
          </Link>
        ) : undefined
      }
    >
      Demo dataset — the supplied synthetic benchmark with pre-authored annotations. Not live backend output.
      {personaLabel ? ` (${personaLabel})` : ''}
    </Banner>
  );
};
