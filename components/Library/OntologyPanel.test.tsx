// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OntologyPanel } from './OntologyPanel';

// Mock heavy sub-components to focus on header & view switching
vi.mock('./D3GraphView', () => ({
  default: () => <div data-testid="d3-graph-view">D3 Graph View Content</div>,
}));
vi.mock('./OntologyDataView', () => ({
  OntologyDataView: () => <div data-testid="ontology-data-view">Ontology Data View Content</div>,
}));
vi.mock('./OntologyCanvas', () => ({
  default: () => <div data-testid="ontology-canvas">Ontology Canvas Content</div>,
}));

afterEach(cleanup);

describe('OntologyPanel View Tabs', () => {
  it('renders the three top view switcher tabs and allows switching', async () => {
    render(<OntologyPanel isActive={true} />);

    // Verify all 3 tabs are present in the header
    const graphTab = screen.getByRole('tab', { name: /知识图谱/i });
    const dataTab = screen.getByRole('tab', { name: /数据视图/i });
    const canvasTab = screen.getByRole('tab', { name: /实体画布/i });

    expect(graphTab).toBeInTheDocument();
    expect(dataTab).toBeInTheDocument();
    expect(canvasTab).toBeInTheDocument();

    // Default view is graph
    expect(screen.getByTestId('d3-graph-view')).toBeInTheDocument();

    // Switch to data view
    fireEvent.click(dataTab);
    expect(screen.getByTestId('ontology-data-view')).toBeInTheDocument();

    // Switch to canvas view
    fireEvent.click(canvasTab);
    expect(screen.getByTestId('ontology-canvas')).toBeInTheDocument();

    // Switch back to graph view
    fireEvent.click(graphTab);
    expect(screen.getByTestId('d3-graph-view')).toBeInTheDocument();
  });

  it('renders hop count regulator with 2-hop active by default and hides on non-graph tabs', async () => {
    render(<OntologyPanel isActive={true} />);

    // In default graph view, hop buttons are present
    const hop1Btn = screen.getByRole('button', { name: '1跳' });
    const hop2Btn = screen.getByRole('button', { name: '2跳' });
    const hop3Btn = screen.getByRole('button', { name: '3跳' });
    const hopAllBtn = screen.getByRole('button', { name: '全图' });

    expect(hop1Btn).toBeInTheDocument();
    expect(hop2Btn).toBeInTheDocument();
    expect(hop3Btn).toBeInTheDocument();
    expect(hopAllBtn).toBeInTheDocument();

    // 2-hop is active by default
    expect(hop2Btn.className).toContain('bg-monokai-cyan');
    expect(hop3Btn.className).not.toContain('bg-monokai-cyan');

    // Click 3-hop
    fireEvent.click(hop3Btn);
    expect(hop3Btn.className).toContain('bg-monokai-cyan');
    expect(hop2Btn.className).not.toContain('bg-monokai-cyan');

    // Switch to data tab -> hop regulator is hidden
    const dataTab = screen.getByRole('tab', { name: /数据视图/i });
    fireEvent.click(dataTab);
    expect(screen.queryByRole('button', { name: '2跳' })).not.toBeInTheDocument();

    // Switch back to graph tab -> hop regulator returns with preserved state
    const graphTab = screen.getByRole('tab', { name: /知识图谱/i });
    fireEvent.click(graphTab);
    expect(screen.getByRole('button', { name: '3跳' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3跳' }).className).toContain('bg-monokai-cyan');
  });
});
