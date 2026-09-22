// @vitest-environment jsdom

import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DragonLogo } from './DragonLogo';

afterEach(cleanup);

describe('DragonLogo', () => {
  it.each([16, 24, 32, 48, 64, 96])('ships a transparent %ipx PNG resource', pixels => {
    const png = readFileSync(resolve(process.cwd(), `public/brand/dragon-mark-${pixels}.png`));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(pixels);
    expect(png.readUInt32BE(20)).toBe(pixels);
    expect(png[25]).toBe(6);
  });

  it('renders the responsive raster dragon mark instead of an inline drawing', () => {
    render(<DragonLogo size="sm" variant="brand" title="龙形品牌标志" />);

    const mark = screen.getByRole('img', { name: '龙形品牌标志' });
    expect(mark.tagName).toBe('IMG');
    expect(mark).toHaveAttribute('src', expect.stringContaining('dragon-mark-24.png'));
    expect(mark).toHaveAttribute('srcset', expect.stringContaining('dragon-mark-48.png 2x'));
  });

  it('keeps custom and watermark variants fluid inside their parent', () => {
    const { container, rerender } = render(<DragonLogo size="custom" variant="watermark" />);
    expect(container.querySelector('img')).toHaveClass('h-full', 'w-full', 'object-contain');

    rerender(<DragonLogo size="2xl" variant="glow" />);
    expect(screen.getByRole('img')).toHaveAttribute('width', '64');
    expect(screen.getByRole('img')).toHaveAttribute('height', '64');
  });
});
