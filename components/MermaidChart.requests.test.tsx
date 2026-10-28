import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
const pending = vi.hoisted(() => new Map<string, (result: { svg: string }) => void>());
vi.mock('mermaid', () => ({ default: { initialize: vi.fn(), render: vi.fn((_id: string, chart: string) => new Promise(resolve => pending.set(chart, resolve))) } }));
vi.mock('./ui/SafeSvgImage', () => ({ SafeSvgImage: ({ svg }: { svg: string }) => <div>{svg}</div> }));
import { MermaidChart } from './MermaidChart';

it('never restores stale SVG after a newer diagram or an empty input', async () => {
  const view = render(<MermaidChart chart="old" />);
  view.rerender(<MermaidChart chart="new" />);
  await act(async () => pending.get('new')!({ svg: 'new-svg' }));
  expect(screen.getByText('new-svg')).toBeInTheDocument();
  await act(async () => pending.get('old')!({ svg: 'old-svg' }));
  expect(screen.queryByText('old-svg')).toBeNull();
  view.rerender(<MermaidChart chart="" />);
  expect(screen.queryByText('new-svg')).toBeNull();
  expect(screen.getByText('暂无图形数据')).toBeInTheDocument();
});
