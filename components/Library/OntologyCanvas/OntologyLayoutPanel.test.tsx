import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OntologyLayoutPanel, type OntologyLayoutPanelProps } from './OntologyLayoutPanel';

describe('OntologyLayoutPanel Component', () => {
  const defaultProps: OntologyLayoutPanelProps = {
    isOpen: true,
    onToggle: vi.fn(),
    onClose: vi.fn(),
    layoutMode: 'orthogonal',
    onLayoutModeChange: vi.fn(),
    nodesep: 100,
    onNodesepChange: vi.fn(),
    ranksep: 200,
    onRanksepChange: vi.fn(),
    parallelOffset: 35,
    onParallelOffsetChange: vi.fn(),
    edgeRoutingMode: 'orthogonal',
    onEdgeRoutingModeChange: vi.fn(),
    isFocusMode: false,
    onFocusModeChange: vi.fn(),
    snapToGrid: true,
    onSnapToGridChange: vi.fn(),
    showGrid: true,
    onShowGridChange: vi.fn(),
    showMiniMap: true,
    onShowMiniMapChange: vi.fn(),
    animateEdges: true,
    onAnimateEdgesChange: vi.fn(),
    enableDbClickCreate: true,
    onEnableDbClickCreateChange: vi.fn(),
    isReadOnly: false,
    onIsReadOnlyChange: vi.fn(),
    isDefaultExpanded: true,
    onToggleExpandAll: vi.fn(),
    onAutoAlign: vi.fn(),
    onForceResetLayout: vi.fn(),
    onFitView: vi.fn(),
    onResetZoom: vi.fn(),
    onResetDefaults: vi.fn(),
    onLockAll: vi.fn(),
    onUnlockAll: vi.fn(),
    lockedCount: 2,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    canUndo: true,
    canRedo: false,
    nodeCount: 12,
    edgeCount: 18,
    nodes: [
      { id: 1, name: 'EntityA' },
      { id: 2, name: 'EntityB' },
    ],
    edges: [
      { id: 'e1', source: '1', target: '2' },
    ],
    defaultTab: 'layout',
  };

  it('renders trigger capsule button and open panel with header and layout mode info', () => {
    render(<OntologyLayoutPanel {...defaultProps} />);
    expect(screen.getAllByText('排版微调').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('实体排版微调')).toBeTruthy();
    expect(screen.getByText('12 实体 · 18 关系 · 正交网格')).toBeTruthy();
  });

  it('triggers onToggle when trigger button is clicked and onClose when close button clicked', () => {
    render(<OntologyLayoutPanel {...defaultProps} />);
    const triggerBtn = screen.getByRole('button', { name: '排版微调' });
    fireEvent.click(triggerBtn);
    expect(defaultProps.onToggle).toHaveBeenCalled();

    const closeBtn = screen.getByLabelText('收起控制面板');
    fireEvent.click(closeBtn);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('supports switching layout modes via layout matrix', () => {
    render(<OntologyLayoutPanel {...defaultProps} defaultTab="layout" />);
    const hierarchicalBtn = screen.getByTestId('ontology-layout-hierarchical');
    expect(hierarchicalBtn).toBeTruthy();
    fireEvent.click(hierarchicalBtn);

    expect(defaultProps.onLayoutModeChange).toHaveBeenCalledWith('hierarchical');
    expect(defaultProps.onAutoAlign).toHaveBeenCalledWith(100, 200, 'hierarchical');
  });

  it('supports applying scenario presets', () => {
    render(<OntologyLayoutPanel {...defaultProps} defaultTab="layout" />);
    const compactBtn = screen.getByText('紧凑分层');
    fireEvent.click(compactBtn);

    expect(defaultProps.onNodesepChange).toHaveBeenCalledWith(70);
    expect(defaultProps.onRanksepChange).toHaveBeenCalledWith(140);
    expect(defaultProps.onLayoutModeChange).toHaveBeenCalledWith('hierarchical');
    expect(defaultProps.onEdgeRoutingModeChange).toHaveBeenCalledWith('bezier');
    expect(defaultProps.onAutoAlign).toHaveBeenCalledWith(70, 140, 'hierarchical');
  });

  it('supports adjusting ranksep and nodesep sliders in spacing tab', () => {
    render(<OntologyLayoutPanel {...defaultProps} defaultTab="spacing" />);
    expect(screen.getAllByText('200px').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('100px').length).toBeGreaterThanOrEqual(1);

    const stepUpBtn = screen.getByText('+20');
    fireEvent.click(stepUpBtn);
    expect(defaultProps.onRanksepChange).toHaveBeenCalledWith(220);
    expect(defaultProps.onAutoAlign).toHaveBeenCalledWith(100, 220, 'orthogonal');

    const stepDownNodeBtn = screen.getByText('-10');
    fireEvent.click(stepDownNodeBtn);
    expect(defaultProps.onNodesepChange).toHaveBeenCalledWith(90);
    expect(defaultProps.onAutoAlign).toHaveBeenCalledWith(90, 200, 'orthogonal');
  });

  it('supports switching edge routing styles in spacing tab', () => {
    render(<OntologyLayoutPanel {...defaultProps} defaultTab="spacing" />);
    const bezierBtn = screen.getByText('平滑贝塞尔');
    fireEvent.click(bezierBtn);
    expect(defaultProps.onEdgeRoutingModeChange).toHaveBeenCalledWith('bezier');

    const straightBtn = screen.getByText('极简直线');
    fireEvent.click(straightBtn);
    expect(defaultProps.onEdgeRoutingModeChange).toHaveBeenCalledWith('straight');
  });

  it('supports toggling canvas interaction switches in canvas tab', () => {
    render(<OntologyLayoutPanel {...defaultProps} defaultTab="canvas" />);
    // Checkboxes include default expand, focus, grid snap, dots, minimap, animation, dblclick, readonly
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(7);

    // Toggle default expand (first checkbox)
    fireEvent.click(checkboxes[0]);
    expect(defaultProps.onToggleExpandAll).toHaveBeenCalledWith(false);

    // Toggle focus mode (second checkbox)
    fireEvent.click(checkboxes[1]);
    expect(defaultProps.onFocusModeChange).toHaveBeenCalledWith(true);

    // Lock All / Unlock All buttons
    const lockAllBtn = screen.getByText('全部锁定');
    fireEvent.click(lockAllBtn);
    expect(defaultProps.onLockAll).toHaveBeenCalled();

    const unlockAllBtn = screen.getByText('解除锁定');
    fireEvent.click(unlockAllBtn);
    expect(defaultProps.onUnlockAll).toHaveBeenCalled();
  });

  it('renders diagnostics stats and supports global recalibration in diagnostics tab', () => {
    render(<OntologyLayoutPanel {...defaultProps} defaultTab="diagnostics" />);
    expect(screen.getByText('本体排版质量评分')).toBeTruthy();
    expect(screen.getByText('自适应居中')).toBeTruthy();

    const fitBtn = screen.getByText('自适应居中');
    fireEvent.click(fitBtn);
    expect(defaultProps.onFitView).toHaveBeenCalled();

    const resetLayoutBtn = screen.getByText('重置全局网格排版');
    fireEvent.click(resetLayoutBtn);
    expect(defaultProps.onForceResetLayout).toHaveBeenCalled();
  });

  it('handles reset defaults and keyboard shortcuts modal in header', () => {
    render(<OntologyLayoutPanel {...defaultProps} />);
    const resetDefaultsBtn = screen.getByLabelText('恢复默认设置');
    fireEvent.click(resetDefaultsBtn);
    expect(defaultProps.onResetDefaults).toHaveBeenCalled();

    const shortcutsBtn = screen.getByLabelText('快捷键速查');
    fireEvent.click(shortcutsBtn);
    expect(screen.getByText('画布排版快捷键')).toBeTruthy();
  });
});
