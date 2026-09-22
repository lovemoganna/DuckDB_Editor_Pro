import React, { useRef, useEffect, useState } from 'react';
import {
  Layers,
  Database,
  Users,
  ShoppingBag,
  Truck,
  ShieldAlert,
  DollarSign,
  Plus,
  ArrowRight,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { useOntologyWorkspaceStore } from '../../hooks/useOntologyWorkspaceStore';
import { OntologyNode, AbstractionLevel } from '../../types/ontologyWorkspace';

export const OntologyMapCanvas: React.FC = () => {
  const {
    nodes,
    edges,
    context,
    setFocusEntity,
    selectEntity,
    setActiveMode,
    setSelectedDrawerTab,
  } = useOntologyWorkspaceStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number; width: number; height: number }>>({});

  const domains = ['Commerce', 'Customer', 'Fulfillment', 'Risk', 'Finance'];

  const levels: { key: AbstractionLevel; code: string; title: string; countLabel: string }[] = [
    { key: 'L0', code: 'L0', title: 'Upper Ontology', countLabel: `${nodes.filter((node) => node.abstractionLevel === 'L0').length} classes` },
    { key: 'L1', code: 'L1', title: 'Domain Concepts', countLabel: `${nodes.filter((node) => node.abstractionLevel === 'L1').length} classes` },
    { key: 'L2', code: 'L2', title: 'Specialized Concepts', countLabel: `${nodes.filter((node) => node.abstractionLevel === 'L2').length} classes` },
    { key: 'L3', code: 'L3', title: 'Individuals (Aggregated)', countLabel: `${nodes.filter((node) => node.abstractionLevel === 'L3').length} entity types` },
    { key: 'GROUNDING', code: 'GROUNDING LAYER', title: 'Physical Data', countLabel: `${nodes.filter((node) => node.abstractionLevel === 'GROUNDING').length} data sources` },
  ];

  // Measure DOM positions of nodes to draw accurate SVG links
  useEffect(() => {
    const updatePositions = () => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const posMap: Record<string, { x: number; y: number; width: number; height: number }> = {};

      const nodeElements = containerRef.current.querySelectorAll<HTMLDivElement>('[data-ontology-node]');
      nodeElements.forEach((el) => {
        const nodeId = el.getAttribute('data-ontology-node');
        if (!nodeId) return;
        const rect = el.getBoundingClientRect();
        posMap[nodeId] = {
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top + rect.height / 2,
          width: rect.width,
          height: rect.height,
        };
      });

      setNodePositions(posMap);
    };

    updatePositions();
    window.addEventListener('resize', updatePositions);
    const timeout = setTimeout(updatePositions, 100);
    return () => {
      window.removeEventListener('resize', updatePositions);
      clearTimeout(timeout);
    };
  }, [nodes, context.domainFilter]);

  const handleNodeClick = (e: React.MouseEvent, nodeName: string) => {
    e.stopPropagation();
    if (e.shiftKey) {
      selectEntity(nodeName, true);
    } else {
      selectEntity(nodeName, false);
      setFocusEntity(nodeName);
    }
  };

  const handleNodeDoubleClick = (e: React.MouseEvent, nodeName: string) => {
    e.stopPropagation();
    setFocusEntity(nodeName);
    setActiveMode('local');
  };

  const isDomainFiltered = context.domainFilter !== 'All';
  const selectedNodeName = context.focusEntityId || context.selectedEntityIds[0] || 'Product';

  return (
    <div
      ref={containerRef}
      aria-label="知识图谱实体画布"
      className="relative flex-1 overflow-auto bg-monokai-bg custom-scrollbar select-none p-3 min-w-[1020px] min-h-[640px] flex font-sans"
    >
      {/* 1. LEFT RAIL: Y-Axis Abstraction Level Headers */}
      <div className="w-36 shrink-0 flex flex-col justify-between border-r border-monokai-border pr-2 mr-2 z-20">
        <div className="text-[10px] font-bold uppercase tracking-wider text-monokai-comment pb-2 border-b border-monokai-border">
          ONTOLOGY SPACE
        </div>

        {levels.map((lvl) => (
          <div
            key={lvl.key}
            className="flex flex-col justify-center h-[105px] border-b border-monokai-border/60 last:border-b-0 px-1 text-left"
          >
            <span className="font-mono text-xs font-bold text-monokai-purple">{lvl.code}</span>
            <span className="text-[10.5px] text-monokai-fg-muted font-medium leading-tight">{lvl.title}</span>
            <span className="text-[9.5px] text-monokai-comment font-mono mt-0.5">{lvl.countLabel}</span>
          </div>
        ))}
      </div>

      {/* 2. MAIN 5 DOMAIN COLUMNS GRID */}
      <div className="flex-1 grid grid-cols-5 gap-3 relative z-10">
        {domains.map((dom) => {
          const isCurrentDomain = !isDomainFiltered || context.domainFilter === dom;

          return (
            <div
              key={dom}
              className={`flex flex-col border-r border-monokai-border/60 last:border-r-0 px-1.5 transition-opacity duration-200 ${
                isCurrentDomain ? 'opacity-100' : 'opacity-20'
              }`}
            >
              {/* Top Domain Channel Label */}
              <div className="flex items-center justify-center pb-2 text-[11px] font-bold uppercase tracking-wider text-monokai-comment border-b border-monokai-border">
                <span>{dom}</span>
              </div>

              {/* 5 Layer Rows */}
              <div className="flex-1 flex flex-col justify-between py-1">
                {/* L0 Upper Ontology */}
                <div className="h-[105px] flex items-center justify-center relative p-1">
                  {dom === 'Customer' && (
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        data-ontology-node="Thing"
                        onClick={(e) => handleNodeClick(e, 'Thing')}
                        onDoubleClick={(e) => handleNodeDoubleClick(e, 'Thing')}
                        className={`px-3 py-1 rounded bg-monokai-elevated border text-xs font-mono cursor-pointer transition-all ${
                          selectedNodeName === 'Thing'
                            ? 'border-monokai-cyan bg-monokai-elevated text-white shadow ring-2 ring-monokai-cyan/30'
                            : 'border-monokai-border text-monokai-fg-muted hover:border-monokai-cyan'
                        }`}
                      >
                        <span className="text-monokai-purple font-semibold">Thing</span>{' '}
                        <span className="text-[9.5px] text-monokai-comment">(owl:Thing)</span>
                      </div>
                      <div
                        data-ontology-node="BusinessEntity"
                        onClick={(e) => handleNodeClick(e, 'BusinessEntity')}
                        onDoubleClick={(e) => handleNodeDoubleClick(e, 'BusinessEntity')}
                        className={`px-3 py-1 rounded bg-monokai-elevated border text-xs font-mono cursor-pointer transition-all ${
                          selectedNodeName === 'BusinessEntity'
                            ? 'border-monokai-cyan bg-monokai-elevated text-white shadow ring-2 ring-monokai-cyan/30'
                            : 'border-monokai-border text-monokai-fg-muted hover:border-monokai-cyan'
                        }`}
                      >
                        <span className="text-monokai-purple font-semibold">BusinessEntity</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* L1 Domain Concepts */}
                <div className="h-[105px] flex items-center justify-center gap-2 relative p-1 flex-wrap">
                  {dom === 'Commerce' && (
                    <>
                      <div
                        data-ontology-node="Product"
                        onClick={(e) => handleNodeClick(e, 'Product')}
                        onDoubleClick={(e) => handleNodeDoubleClick(e, 'Product')}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                          selectedNodeName === 'Product'
                            ? 'bg-monokai-elevated border-2 border-monokai-cyan text-white shadow-lg shadow-monokai-cyan/30 ring-2 ring-monokai-cyan/40 scale-105 z-30'
                            : 'bg-monokai-elevated border-monokai-border text-monokai-fg hover:border-monokai-cyan'
                        }`}
                      >
                        <span className="h-2 w-2 rounded-full bg-monokai-purple" />
                        <span>Product</span>
                        <span className="text-[9.5px] font-mono text-monokai-comment bg-monokai-bg px-1 rounded">Class</span>
                      </div>

                      <div
                        data-ontology-node="Category"
                        onClick={(e) => handleNodeClick(e, 'Category')}
                        onDoubleClick={(e) => handleNodeDoubleClick(e, 'Category')}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                          selectedNodeName === 'Category'
                            ? 'bg-monokai-elevated border-2 border-monokai-cyan text-white shadow ring-2 ring-monokai-cyan/30'
                            : 'bg-monokai-elevated border-monokai-border text-monokai-fg hover:border-monokai-cyan'
                        }`}
                      >
                        <span className="h-2 w-2 rounded-full bg-monokai-purple" />
                        <span>Category</span>
                      </div>

                      <div
                        data-ontology-node="Supplier"
                        onClick={(e) => handleNodeClick(e, 'Supplier')}
                        onDoubleClick={(e) => handleNodeDoubleClick(e, 'Supplier')}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                          selectedNodeName === 'Supplier'
                            ? 'bg-monokai-elevated border-2 border-monokai-cyan text-white shadow ring-2 ring-monokai-cyan/30'
                            : 'bg-monokai-elevated border-monokai-border text-monokai-fg hover:border-monokai-cyan'
                        }`}
                      >
                        <span className="h-2 w-2 rounded-full bg-monokai-purple" />
                        <span>Supplier</span>
                      </div>
                    </>
                  )}

                  {dom === 'Customer' && (
                    <div
                      data-ontology-node="Customer"
                      onClick={(e) => handleNodeClick(e, 'Customer')}
                      onDoubleClick={(e) => handleNodeDoubleClick(e, 'Customer')}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                        selectedNodeName === 'Customer'
                          ? 'bg-monokai-elevated border-2 border-monokai-cyan text-white shadow ring-2 ring-monokai-cyan/30'
                          : 'bg-monokai-elevated border-monokai-border text-monokai-fg hover:border-monokai-cyan'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-monokai-purple" />
                      <span>Customer</span>
                    </div>
                  )}

                  {dom === 'Fulfillment' && (
                    <>
                      <div
                        data-ontology-node="Order"
                        onClick={(e) => handleNodeClick(e, 'Order')}
                        onDoubleClick={(e) => handleNodeDoubleClick(e, 'Order')}
                        className="px-2.5 py-1.5 rounded-lg border border-monokai-border bg-monokai-elevated text-monokai-fg hover:border-monokai-cyan text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                      >
                        <span className="h-2 w-2 rounded-full bg-monokai-purple" />
                        <span>Order</span>
                      </div>
                      <div
                        data-ontology-node="Shipment"
                        onClick={(e) => handleNodeClick(e, 'Shipment')}
                        onDoubleClick={(e) => handleNodeDoubleClick(e, 'Shipment')}
                        className="px-2.5 py-1.5 rounded-lg border border-monokai-border bg-monokai-elevated text-monokai-fg hover:border-monokai-cyan text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                      >
                        <span className="h-2 w-2 rounded-full bg-monokai-purple" />
                        <span>Shipment</span>
                      </div>
                      <div
                        data-ontology-node="Store"
                        onClick={(e) => handleNodeClick(e, 'Store')}
                        onDoubleClick={(e) => handleNodeDoubleClick(e, 'Store')}
                        className="px-2.5 py-1.5 rounded-lg border border-monokai-border bg-monokai-elevated text-monokai-fg hover:border-monokai-cyan text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                      >
                        <span className="h-2 w-2 rounded-full bg-monokai-purple" />
                        <span>Store</span>
                      </div>
                    </>
                  )}

                  {dom === 'Risk' && (
                    <div
                      data-ontology-node="RiskEvent"
                      onClick={(e) => handleNodeClick(e, 'RiskEvent')}
                      onDoubleClick={(e) => handleNodeDoubleClick(e, 'RiskEvent')}
                      className="px-3 py-1.5 rounded-lg border border-monokai-border bg-monokai-elevated text-monokai-fg hover:border-monokai-cyan text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="h-2 w-2 rounded-full bg-monokai-purple" />
                      <span>RiskEvent</span>
                    </div>
                  )}

                  {dom === 'Finance' && (
                    <div
                      data-ontology-node="Payment"
                      onClick={(e) => handleNodeClick(e, 'Payment')}
                      onDoubleClick={(e) => handleNodeDoubleClick(e, 'Payment')}
                      className="px-3 py-1.5 rounded-lg border border-monokai-border bg-monokai-elevated text-monokai-fg hover:border-monokai-cyan text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="h-2 w-2 rounded-full bg-monokai-purple" />
                      <span>Payment</span>
                    </div>
                  )}
                </div>

                {/* L2 Specialized Concepts */}
                <div className="h-[105px] flex items-center justify-center gap-2 relative p-1 flex-wrap">
                  {dom === 'Commerce' && (
                    <>
                      <div
                        data-ontology-node="Electronics"
                        onClick={(e) => handleNodeClick(e, 'Electronics')}
                        className="px-2.5 py-1 rounded bg-monokai-elevated border border-monokai-hover hover:border-monokai-cyan text-monokai-fg-muted text-xs font-mono cursor-pointer"
                      >
                        Electronics
                      </div>
                      <div
                        data-ontology-node="Clothing"
                        onClick={(e) => handleNodeClick(e, 'Clothing')}
                        className="px-2.5 py-1 rounded bg-monokai-elevated border border-monokai-hover hover:border-monokai-cyan text-monokai-fg-muted text-xs font-mono cursor-pointer"
                      >
                        Clothing
                      </div>
                    </>
                  )}

                  {dom === 'Customer' && (
                    <div
                      data-ontology-node="VIPCustomer"
                      onClick={(e) => handleNodeClick(e, 'VIPCustomer')}
                      className="px-2.5 py-1 rounded bg-monokai-elevated border border-monokai-hover hover:border-monokai-cyan text-monokai-fg-muted text-xs font-mono cursor-pointer"
                    >
                      VIPCustomer
                    </div>
                  )}

                  {dom === 'Fulfillment' && (
                    <>
                      <div
                        data-ontology-node="OnlineOrder"
                        onClick={(e) => handleNodeClick(e, 'OnlineOrder')}
                        className="px-2.5 py-1 rounded bg-monokai-elevated border border-monokai-hover hover:border-monokai-cyan text-monokai-fg-muted text-xs font-mono cursor-pointer"
                      >
                        OnlineOrder
                      </div>
                      <div
                        data-ontology-node="InStoreOrder"
                        onClick={(e) => handleNodeClick(e, 'InStoreOrder')}
                        className="px-2.5 py-1 rounded bg-monokai-elevated border border-monokai-hover hover:border-monokai-cyan text-monokai-fg-muted text-xs font-mono cursor-pointer"
                      >
                        InStoreOrder
                      </div>
                      <div
                        data-ontology-node="Return"
                        onClick={(e) => handleNodeClick(e, 'Return')}
                        className="px-2.5 py-1 rounded bg-monokai-elevated border border-monokai-hover hover:border-monokai-cyan text-monokai-fg-muted text-xs font-mono cursor-pointer"
                      >
                        Return
                      </div>
                    </>
                  )}

                  {dom === 'Risk' && (
                    <div
                      data-ontology-node="FraudEvent"
                      onClick={(e) => handleNodeClick(e, 'FraudEvent')}
                      className="px-2.5 py-1 rounded bg-monokai-elevated border border-monokai-hover hover:border-monokai-cyan text-monokai-fg-muted text-xs font-mono cursor-pointer"
                    >
                      FraudEvent
                    </div>
                  )}
                </div>

                {/* L3 Individuals (Aggregated) */}
                <div className="h-[105px] flex items-center justify-center relative p-1">
                  {dom === 'Commerce' && (
                    <div
                      data-ontology-node="Product_agg"
                      className="w-full p-2 rounded-lg border border-monokai-orange bg-monokai-elevated/80 text-monokai-orange font-mono text-center shadow-md cursor-pointer hover:border-monokai-orange"
                    >
                      <div className="font-bold text-xs">Product</div>
                      <div className="text-sm font-extrabold text-monokai-orange">2.35M</div>
                      <div className="text-[9px] text-monokai-orange/80 mt-0.5">instances</div>
                    </div>
                  )}

                  {dom === 'Customer' && (
                    <div
                      data-ontology-node="Customer_agg"
                      className="w-full p-2 rounded-lg border border-monokai-orange bg-monokai-elevated/80 text-monokai-orange font-mono text-center shadow-md"
                    >
                      <div className="font-bold text-xs">Customer</div>
                      <div className="text-sm font-extrabold text-monokai-orange">850K</div>
                      <div className="text-[9px] text-monokai-orange/80 mt-0.5">instances</div>
                    </div>
                  )}

                  {dom === 'Fulfillment' && (
                    <div className="w-full flex gap-1.5">
                      <div className="flex-1 p-1.5 rounded border border-monokai-orange bg-monokai-elevated/80 text-monokai-orange font-mono text-center text-[10.5px]">
                        <div className="font-bold">Order</div>
                        <div className="font-bold">4.1M</div>
                      </div>
                      <div className="flex-1 p-1.5 rounded border border-monokai-orange bg-monokai-elevated/80 text-monokai-orange font-mono text-center text-[10.5px]">
                        <div className="font-bold">Shipment</div>
                        <div className="font-bold">3.2M</div>
                      </div>
                    </div>
                  )}

                  {dom === 'Risk' && (
                    <div className="w-full p-2 rounded-lg border border-monokai-orange bg-monokai-elevated/80 text-monokai-orange font-mono text-center shadow-md">
                      <div className="font-bold text-xs">RiskEvent</div>
                      <div className="text-sm font-extrabold text-monokai-orange">1.2M</div>
                    </div>
                  )}

                  {dom === 'Finance' && (
                    <div className="w-full p-2 rounded-lg border border-monokai-orange bg-monokai-elevated/80 text-monokai-orange font-mono text-center shadow-md">
                      <div className="font-bold text-xs">Payment</div>
                      <div className="text-sm font-extrabold text-monokai-orange">3.9M</div>
                    </div>
                  )}
                </div>

                {/* GROUNDING LAYER (Physical Data) */}
                <div className="h-[105px] flex items-center justify-center relative p-1">
                  {dom === 'Commerce' && (
                    <div
                      data-ontology-node="main.products"
                      onClick={(e) => handleNodeClick(e, 'main.products')}
                      className="w-full p-2 rounded-lg border border-monokai-cyan bg-monokai-elevated text-monokai-cyan font-mono text-left shadow-md cursor-pointer hover:border-monokai-cyan"
                    >
                      <div className="flex items-center gap-1 text-[11px] font-bold">
                        <Database className="h-3 w-3" />
                        <span>main.products</span>
                      </div>
                      <div className="text-[10px] text-monokai-comment mt-0.5">Physical Data · 2.3M rows</div>
                    </div>
                  )}

                  {dom === 'Customer' && (
                    <div
                      data-ontology-node="main.customers"
                      onClick={(e) => handleNodeClick(e, 'main.customers')}
                      className="w-full p-2 rounded-lg border border-monokai-cyan bg-monokai-elevated text-monokai-cyan font-mono text-left shadow-md cursor-pointer"
                    >
                      <div className="flex items-center gap-1 text-[11px] font-bold">
                        <Database className="h-3 w-3" />
                        <span>main.customers</span>
                      </div>
                      <div className="text-[10px] text-monokai-comment mt-0.5">850K rows</div>
                    </div>
                  )}

                  {dom === 'Fulfillment' && (
                    <div className="w-full space-y-1">
                      <div
                        data-ontology-node="main.orders"
                        onClick={(e) => handleNodeClick(e, 'main.orders')}
                        className="p-1 rounded border border-monokai-cyan bg-monokai-elevated text-monokai-cyan font-mono text-[10.5px] cursor-pointer"
                      >
                        main.orders · 4.1M
                      </div>
                      <div
                        data-ontology-node="main.shipments"
                        onClick={(e) => handleNodeClick(e, 'main.shipments')}
                        className="p-1 rounded border border-monokai-cyan bg-monokai-elevated text-monokai-cyan font-mono text-[10.5px] cursor-pointer"
                      >
                        main.shipments · 3.2M
                      </div>
                    </div>
                  )}

                  {dom === 'Finance' && (
                    <div
                      data-ontology-node="ext_payments"
                      onClick={(e) => handleNodeClick(e, 'ext_payments')}
                      className="w-full p-2 rounded-lg border border-monokai-cyan bg-monokai-elevated text-monokai-cyan font-mono text-left shadow-md cursor-pointer"
                    >
                      <div className="flex items-center gap-1 text-[11px] font-bold">
                        <ExternalLink className="h-3 w-3" />
                        <span>ext_payments</span>
                      </div>
                      <div className="text-[10px] text-monokai-comment mt-0.5">External API</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. FLOATING GRAPH LEGEND (Top-Right) */}
      <div className="absolute right-4 top-4 p-3 rounded-lg border border-monokai-hover bg-monokai-bg/95 backdrop-blur text-[10.5px] space-y-1 text-monokai-comment shadow-2xl z-40">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-monokai-purple" />
          <span>Class</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-monokai-cyan" />
          <span>Object Property</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-monokai-cyan" />
          <span>Data Property</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-monokai-orange" />
          <span>Individual (Agg.)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-monokai-cyan" />
          <span>Data Source</span>
        </div>
        <div className="pt-1 border-t border-monokai-hover space-y-1 text-[10px]">
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 bg-monokai-comment" />
            <span>subClassOf</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 bg-monokai-cyan" />
            <span>same-level relation</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 border-t border-dashed border-monokai-cyan" />
            <span>mappedTo</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 border-t border-dashed border-monokai-orange" />
            <span>inferred</span>
          </div>
        </div>
      </div>

      {/* 4. DYNAMIC SVG RELATION HIGHWAYS */}
      <svg
        className="absolute inset-0 pointer-events-none w-full h-full"
        style={{ zIndex: 15 }}
      >
        <defs>
          <marker id="arrowhead" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 1 2 L 10 6 L 1 10 L 3.5 6 z" fill="var(--monokai-cyan)" stroke="var(--monokai-bg)" strokeWidth="1" />
          </marker>
          <marker id="arrowhead-dim" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 1 2 L 10 6 L 1 10 L 3.5 6 z" fill="var(--monokai-comment)" stroke="var(--monokai-bg)" strokeWidth="0.8" />
          </marker>
        </defs>

        {edges.filter((edge) => {
          if (context.assertedInferredFilter === 'asserted' && !edge.asserted) return false;
          if (context.assertedInferredFilter === 'inferred' && !edge.inferred) return false;
          if (context.relationTypeFilter !== 'All' && edge.type !== context.relationTypeFilter && edge.relationName !== context.relationTypeFilter) return false;
          return true;
        }).map((e) => {
          const fromPos = nodePositions[e.source];
          const toPos = nodePositions[e.target];
          if (!fromPos || !toPos) return null;

          const isConnectedToSelected =
            e.source === selectedNodeName || e.target === selectedNodeName;

          const isHierarchy = e.type === 'subClassOf';
          const isMapping = e.type === 'mappedTo';
          const isInferred = e.type === 'inferred';

          // Smooth curve control points with adaptive vertical deflection avoiding node rectangles
          const dx = toPos.x - fromPos.x;
          const dy = toPos.y - fromPos.y;
          const cx = fromPos.x + dx / 2;
          const cy = fromPos.y + dy / 2 + (Math.abs(dx) > 100 ? (dy >= 0 ? 38 : -38) : (dx >= 0 ? 24 : -24));

          // Docking offsets so arrowheads never penetrate node cards
          const targetMargin = 6;
          const startMargin = 4;
          const pathD = isHierarchy
            ? `M ${fromPos.x} ${fromPos.y - fromPos.height / 2 - startMargin} L ${toPos.x} ${toPos.y + toPos.height / 2 + targetMargin}`
            : isMapping
            ? `M ${fromPos.x} ${fromPos.y + fromPos.height / 2 + startMargin} L ${toPos.x} ${toPos.y - toPos.height / 2 - targetMargin}`
            : `M ${fromPos.x + (dx > 0 ? fromPos.width / 2 : -fromPos.width / 2)} ${fromPos.y} Q ${cx} ${cy} ${toPos.x - (dx > 0 ? toPos.width / 2 + targetMargin : -toPos.width / 2 - targetMargin)} ${toPos.y}`;

          const strokeColor = isConnectedToSelected
            ? isMapping
              ? 'var(--monokai-cyan)'
              : isInferred
              ? 'var(--monokai-orange)'
              : 'var(--monokai-cyan)'
            : isMapping
            ? 'var(--monokai-cyan)'
            : 'var(--monokai-hover)';

          const strokeWidth = isConnectedToSelected ? 2.2 : 1.2;
          const strokeDasharray = isMapping ? '4,4' : isInferred ? '3,3' : undefined;

          return (
            <g key={e.id}>
              {/* Visual Bridge Halo to prevent crossing occlusion */}
              <path
                d={pathD}
                fill="none"
                stroke="var(--monokai-bg)"
                strokeWidth={strokeWidth + 2.8}
                strokeLinecap="round"
                opacity={0.95}
              />
              <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                opacity={isConnectedToSelected ? 1 : 0.4}
                markerEnd={isConnectedToSelected ? 'url(#arrowhead)' : 'url(#arrowhead-dim)'}
              />
              {isConnectedToSelected && !isHierarchy && !isMapping && (
                <g transform={`translate(${cx}, ${cy - 4})`}>
                  <rect
                    x={-(e.relationName.length * 3.5 + 8)}
                    y={-8}
                    width={e.relationName.length * 7 + 16}
                    height={16}
                    rx={3}
                    fill="var(--monokai-bg)"
                    stroke="var(--monokai-border)"
                    strokeWidth={1}
                    opacity={0.96}
                  />
                  <text
                    x={0}
                    y={3}
                    fill="var(--monokai-cyan)"
                    fontSize="9.5"
                    fontFamily="monospace"
                    textAnchor="middle"
                    className="select-none pointer-events-none"
                  >
                    {e.relationName}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
