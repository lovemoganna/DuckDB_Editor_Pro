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
});
