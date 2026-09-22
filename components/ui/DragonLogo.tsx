import React from 'react';

export type DragonLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'custom';
export type DragonLogoVariant = 'brand' | 'icon' | 'monochrome' | 'watermark' | 'glow';

interface DragonLogoProps {
  size?: DragonLogoSize;
  variant?: DragonLogoVariant;
  className?: string;
  animated?: boolean;
  title?: string;
}

interface DragonLogoSizeConfig {
  box: string;
  image: string;
  pixels: 16 | 24 | 32 | 48 | 64 | 96;
  renderedPixels?: number;
}

const SIZE_MAP: Record<DragonLogoSize, DragonLogoSizeConfig> = {
  xs: { box: 'h-6 w-6', image: 'h-4 w-4', pixels: 16, renderedPixels: 16 },
  sm: { box: 'h-8 w-8', image: 'h-6 w-6', pixels: 24, renderedPixels: 24 },
  md: { box: 'h-10 w-10', image: 'h-8 w-8', pixels: 32, renderedPixels: 32 },
  lg: { box: 'h-12 w-12', image: 'h-9 w-9', pixels: 48, renderedPixels: 36 },
  xl: { box: 'h-16 w-16', image: 'h-12 w-12', pixels: 64, renderedPixels: 48 },
  '2xl': { box: 'h-24 w-24', image: 'h-16 w-16', pixels: 96, renderedPixels: 64 },
  '3xl': { box: 'h-32 w-32', image: 'h-24 w-24', pixels: 96, renderedPixels: 96 },
  custom: { box: 'h-full w-full', image: 'h-full w-full', pixels: 96 },
};

const assetUrl = (pixels: DragonLogoSizeConfig['pixels']) =>
  `${import.meta.env.BASE_URL}brand/dragon-mark-${pixels}.png`;

export const DragonLogo: React.FC<DragonLogoProps> = ({
  size = 'md',
  variant = 'brand',
  className = '',
  animated = false,
  title = 'DuckDB Manager 龙形品牌标志',
}) => {
  const config = SIZE_MAP[size] || SIZE_MAP.md;
  const compactMark = size === 'xs' || size === 'sm';
  const retinaPixels = Math.min(config.pixels * 2, 96) as DragonLogoSizeConfig['pixels'];
  const image = (
    <img
      src={assetUrl(config.pixels)}
      srcSet={`${assetUrl(config.pixels)} 1x, ${assetUrl(retinaPixels)} 2x`}
      alt={variant === 'watermark' ? '' : title}
      width={config.renderedPixels}
      height={config.renderedPixels}
      draggable={false}
      className={`${config.image} shrink-0 object-contain select-none ${
        variant === 'monochrome' ? 'grayscale brightness-125' : ''
      }`}
    />
  );

  if (variant === 'icon' || variant === 'monochrome') {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center ${config.box} ${className}`}>
        {image}
      </span>
    );
  }

  if (variant === 'watermark') {
    return (
      <span aria-hidden="true" className={`pointer-events-none inline-flex shrink-0 select-none items-center justify-center opacity-20 ${config.box} ${className}`}>
        {image}
      </span>
    );
  }

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden ${
        compactMark ? '' : `dragon-logo-frame border border-monokai-border bg-monokai-sidebar ${variant === 'glow' ? 'border-monokai-cyan/50' : ''}`
      } ${animated ? 'transition-opacity hover:opacity-90' : ''} ${config.box} ${className}`}
    >
      {image}
    </span>
  );
};
