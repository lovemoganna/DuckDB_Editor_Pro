import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TopologyLayoutPanel } from './TopologyLayoutPanel';

describe('TopologyLayoutPanel Component', () => {
  const defaultProps = {
    onFitAll: vi.fn(),
    onResetLayout: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onRefresh: vi.fn(),
    layoutMode: 'topologicalFlow' as const,
    onLayoutModeChange: vi.fn(),
    searchTerm: '',
    onSearchTermChange: vi.fn(),
    clickToFocus: true,
    onClickToFocusChange: vi.fn(),
    isFixedDrag: false,
    onIsFixedDragChange: vi.fn(),
    isLassoMode: false,
    onIsLassoModeChange: vi.fn(),
    showPageRank: false,
    onShowPageRankChange: vi.fn(),
    chargeStrength: -160,
    onChargeStrengthChange: vi.fn(),
    linkDistance: 75,
    onLinkDistanceChange: vi.fn(),
    collisionRadius: 14,
    onCollisionRadiusChange: vi.fn(),
    velocityDecay: 0.42,
    onVelocityDecayChange: vi.fn(),
    gravityStrength: 0.25,
    onGravityStrengthChange: vi.fn(),
    linkStrength: 0.6,
    onLinkStrengthChange: vi.fn(),
    nodeCount: 15,
    linkCount: 20,
    onClose: vi.fn(),
    onNodeTypeFiltersChange: vi.fn(),
    onLabelModeChange: vi.fn(),
    onWeightThresholdChange: vi.fn(),
    onExportPNG: vi.fn(),
    onAIFill: vi.fn(),
    onClear: vi.fn(),
  };

  it('renders correctly with 拓扑布局 header and category badge', () => {
    render(<TopologyLayoutPanel {...defaultProps} />);
    expect(screen.getByText('拓扑布局')).toBeTruthy();
    expect(screen.getAllByText('层级结构').length).toBeGreaterThanOrEqual(1);
  });

  it('triggers onClose when close button is clicked', () => {
    render(<TopologyLayoutPanel {...defaultProps} />);
    const closeBtn = screen.getByLabelText('隐藏控制面板');
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('supports toggling tabs and interaction controls in visuals tab', () => {
    render(<TopologyLayoutPanel {...defaultProps} defaultTab="visuals" />);
    const focusBtn = screen.getByLabelText('点击聚焦模式');
    fireEvent.click(focusBtn);
    expect(defaultProps.onClickToFocusChange).toHaveBeenCalledWith(false);

    const lockBtn = screen.getByLabelText('固定拖拽模式');
    fireEvent.click(lockBtn);
    expect(defaultProps.onIsFixedDragChange).toHaveBeenCalledWith(true);
  });

  it('supports switching layout modes and filtering by category', () => {
    render(<TopologyLayoutPanel {...defaultProps} defaultTab="layout" />);
    // Select Dagre layout
    const dagreBtn = screen.getByText('Dagre 严格分层');
    fireEvent.click(dagreBtn);
    expect(defaultProps.onLayoutModeChange).toHaveBeenCalledWith('dagre');
  });

  it('supports searching layout modes independently without affecting node search', () => {
    render(<TopologyLayoutPanel {...defaultProps} defaultTab="layout" />);
    const searchInput = screen.getByPlaceholderText(/搜索 12 种布局特性/i);
    fireEvent.change(searchInput, { target: { value: '网格' } });
    expect(screen.getByText('同质正交网格')).toBeTruthy();
    // Verify onSearchTermChange (for canvas entities) was NOT called
    expect(defaultProps.onSearchTermChange).not.toHaveBeenCalled();
  });

  it('supports physics adjustments in physics tab', () => {
    render(<TopologyLayoutPanel {...defaultProps} defaultTab="physics" />);
    const spreadBtn = screen.getByText('展开避障');
    fireEvent.click(spreadBtn);
    expect(defaultProps.onChargeStrengthChange).toHaveBeenCalledWith(-280);
    expect(defaultProps.onLinkDistanceChange).toHaveBeenCalledWith(200);
  });

  it('renders analytics and quality score in diagnostics tab', () => {
    render(
      <TopologyLayoutPanel
        {...defaultProps}
        defaultTab="analytics"
        fps={58}
        renderTime={14}
        perfHistory={[{ timestamp: 1, fps: 58, renderTime: 14, nodeCount: 15 }]}
      />
    );
    expect(screen.getByText('拓扑健康指数')).toBeTruthy();
    expect(screen.getByText('渲染动力学监控')).toBeTruthy();
  });

  it('triggers view control buttons at bottom bar', () => {
    render(<TopologyLayoutPanel {...defaultProps} />);
    const fitBtn = screen.getByTitle('适应全图视角 (0)');
    fireEvent.click(fitBtn);
    expect(defaultProps.onFitAll).toHaveBeenCalledTimes(1);

    const resetBtn = screen.getByTitle('重置物理状态 (R)');
    fireEvent.click(resetBtn);
    expect(defaultProps.onResetLayout).toHaveBeenCalledTimes(1);
  });

  it('supports edge presentation controls in visuals tab (hierarchy links, flow particles, routing mode)', () => {
    const onShowHierarchyLinksChange = vi.fn();
    const onEnableLinkParticlesChange = vi.fn();
    const onEdgeRoutingModeChange = vi.fn();

    render(
      <TopologyLayoutPanel
        {...defaultProps}
        defaultTab="visuals"
        showHierarchyLinks={true}
        onShowHierarchyLinksChange={onShowHierarchyLinksChange}
        enableLinkParticles={true}
        onEnableLinkParticlesChange={onEnableLinkParticlesChange}
        edgeRoutingMode="spline"
        onEdgeRoutingModeChange={onEdgeRoutingModeChange}
      />
    );

    // Toggle hierarchy links
    const hierarchyBtn = screen.getByLabelText('切换层级归属连线');
    fireEvent.click(hierarchyBtn);
    expect(onShowHierarchyLinksChange).toHaveBeenCalledWith(false);

    // Toggle link particles
    const particlesBtn = screen.getByLabelText('切换业务流向动态粒子');
    fireEvent.click(particlesBtn);
    expect(onEnableLinkParticlesChange).toHaveBeenCalledWith(false);

    // Switch routing mode to Straight
    const straightBtn = screen.getByText(/经典直连线/i);
    fireEvent.click(straightBtn);
    expect(onEdgeRoutingModeChange).toHaveBeenCalledWith('straight');
  });
});
