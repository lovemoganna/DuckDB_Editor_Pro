# Visualization Source Inventory

Source references only; no runtime PASS is implied. See matching JSON for hashes and dependency edges.

| File | Libraries | Render references |
| --- | --- | --- |
| components/AnalysisHub/AnalysisChartRenderer.tsx | - | ChartRenderer |
| components/AnalysisHub/AnalysisHubPanel.tsx | - | AnalysisPivotWorkbench |
| components/AnalysisHub/AnalysisPivotWorkbench.tsx | - | AnalysisChartRenderer |
| components/AnalysisHub/AnalysisRecipeCenter.tsx | - | AnalysisChartRenderer |
| components/AnalysisHub/AnalysisTimeSeries.tsx | - | AnalysisChartRenderer |
| components/AnalysisHub/analysisUi.tsx | - | shared dependency |
| components/AnalysisHub/index.ts | - | shared dependency |
| components/AnalysisHub/LinkedAnalysis.tsx | - | AnalysisChartRenderer |
| components/CausalGraph.tsx | reactflow | ReactFlow |
| components/ChartBuilder.tsx | - | WidgetChartConfigPanel, ChartRenderer |
| components/ChartDashboard.tsx | - | ChartRenderer |
| components/charts/ChartRenderer.tsx | chart.js, react-chartjs-2 | PivotTableView, CanvasView |
| components/charts/ChartViewport.tsx | - | shared dependency |
| components/charts/index.ts | - | shared dependency |
| components/charts/PivotTableView.tsx | - | shared dependency |
| components/Dashboard/Home/DatasetPreview.tsx | - | shared dependency |
| components/Dashboard/Home/ExecutiveOverview.tsx | - | AnalysisChartRenderer |
| components/Dashboard/KpiDynamicMiniCharts.tsx | - | svg |
| components/Dashboard/MissionControl/DashboardSvgIllustrations.tsx | - | svg |
| components/Dashboard/MissionControl/DataAssetTopologyView.tsx | - | svg |
| components/Dashboard/MissionControl/DataIdeMissionControl.tsx | - | HomeBoardCanvas |
| components/Dashboard/MissionControl/PerformanceTrendStrip.tsx | - | svg |
| components/Dashboard/MissionControl/SystemHealthGauges.tsx | - | CircularGauge |
| components/Dashboard/WidgetChartConfigPanel.tsx | - | shared dependency |
| components/DashboardWidget.tsx | - | ChartRenderer, WidgetChartConfigPanel |
| components/DataFlow/DataFlowCanvas.tsx | reactflow | DataFlowAssetSidebar, CanvasToolbar, ReactFlow, DataFlowInspector, DataFlowBottomDrawer, ReactFlowProvider, DataFlowCanvasInner |
| components/DataFlow/edges/DataFlowCustomEdge.tsx | reactflow | shared dependency |
| components/DataFlow/nodes/DataFlowNode.tsx | reactflow | shared dependency |
| components/DataFlow/panels/DataFlowInspector.tsx | - | LogicalFlowInspector, DataFlowNodeConfig |
| components/ERDiagram.tsx | mermaid | shared dependency |
| components/ExecutionPlan/canvas/ExecutionCanvas.tsx | - | CanvasControls |
| components/ExecutionPlan/canvas/SvgEdgeLayer.tsx | - | svg |
| components/ExecutionPlan/layout/planLayout.ts | dagre | shared dependency |
| components/ExecutionPlan/views/ExecutionPlanView.tsx | - | ExecutionCanvas |
| components/KnowledgeHub/components/RightDetailWorkbench.tsx | - | D3GraphView |
| components/layout/AppTopBar.tsx | - | ChartLinePhosphor, SparklePhosphor |
| components/Learn/AcademyMarkdownReader.tsx | mermaid | shared dependency |
| components/Learn/MarkdownViewer.tsx | mermaid | svg |
| components/Learn/OntologyCaseStudio.tsx | - | svg |
| components/Learn/OntologyInteractiveViewer.tsx | - | svg |
| components/Library/D3GraphView/D3GraphView.layout.ts | dagre, d3 | shared dependency |
| components/Library/D3GraphView/D3GraphViewMinimap.tsx | - | canvas |
| components/Library/D3GraphView/GraphRenderer.tsx | d3 | shared dependency |
| components/Library/D3GraphView/renderEngineMeta.tsx | - | svg |
| components/Library/D3GraphView/TopologyLayoutPanel.tsx | - | PerfMiniChart |
| components/Library/D3GraphView.tsx | d3 | CanvasHelpPanel |
| components/Library/ExampleGuide.tsx | d3 | MiniGraph |
| components/Library/GraphOverlayPanels.tsx | - | svg |
| components/Library/OntologyCanvas/hooks/useCanvasSnapshot.ts | reactflow | shared dependency |
| components/Library/OntologyCanvas/hooks/useClipboard.ts | reactflow | shared dependency |
| components/Library/OntologyCanvas/hooks/useHistory.ts | reactflow | shared dependency |
| components/Library/OntologyCanvas/hooks/useSelection.ts | reactflow | shared dependency |
| components/Library/OntologyCanvas/OntologyCteCompiler.ts | reactflow | shared dependency |
| components/Library/OntologyCanvas/OntologyEdge.tsx | reactflow | shared dependency |
| components/Library/OntologyCanvas/OntologyExport.ts | reactflow | shared dependency |
| components/Library/OntologyCanvas/OntologyLayout.ts | dagre, d3-force, reactflow | shared dependency |
| components/Library/OntologyCanvas/OntologyLayoutPanel.tsx | - | svg |
| components/Library/OntologyCanvas/OntologyNode.tsx | reactflow | svg |
| components/Library/OntologyCanvas/OntologyRouting.ts | reactflow | shared dependency |
| components/Library/OntologyCanvas/SearchEnhancement.tsx | - | svg |
| components/Library/OntologyCanvas.tsx | reactflow | OntologyCanvasHeader, ReactFlow, CanvasContextMenu, ReactFlowProvider, OntologyCanvasInner |
| components/Library/OntologyDataView.tsx | - | svg |
| components/Library/ontologyLayout.types.ts | reactflow | shared dependency |
| components/Library/ontologyLayoutEngine.ts | dagre | shared dependency |
| components/Library/OntologyModelingWizard.tsx | - | OntologyWorkbenchGraph |
| components/Library/OntologyPanel.tsx | - | D3GraphView, OntologyCanvas |
| components/Library/SchemaGraphView.tsx | d3 | svg |
| components/Library/useGraphInteraction.ts | d3 | shared dependency |
| components/MermaidChart.tsx | mermaid | shared dependency |
| components/MetricManager.tsx | - | MetricChartListModal, LineageGraphView |
| components/OntologyStudio/OntologyEntityCard.tsx | reactflow | shared dependency |
| components/OntologyStudio/OntologyRelationEdge.tsx | reactflow | shared dependency |
| components/OntologyStudio/OntologyStudio.tsx | - | OntologyStudioCanvas |
| components/OntologyStudio/OntologyStudioCanvas.tsx | reactflow | ReactFlow, ReactFlowProvider, CanvasInner |
| components/OntologyWorkspace/OntologyMapCanvas.tsx | - | svg |
| components/OntologyWorkspace/OntologyWorkspace.tsx | - | OntologyMapCanvas, OntologyLocalCanvas |
| components/schema-generator/HandbookViewer.tsx | - | MermaidChart |
| components/SchemaGenerator.tsx | - | ERDiagram |
| components/skills/nodes/SkillNode.tsx | reactflow | shared dependency |
| components/skills/PipelineBuilder.tsx | reactflow | ReactFlow |
| components/skills/store/usePipelineStore.ts | reactflow | shared dependency |
| components/SqlEditor/SqlEditorExplainView.tsx | - | MermaidChart |
| components/SqlEditor/SqlEditorHelpPanel.tsx | - | svg |
| components/SqlEditor.tsx | - | ChartDashboard, ChartBuilder |
| components/StructureTab.tsx | - | SchemaGraph |
| components/ui/ResizablePanel.tsx | - | svg |
| components/Visualization/VisualizationCard.tsx | - | ChartRenderer |
| components/Visualization/VisualizationWorkbench.tsx | - | ChartBuilder, LineageGraphView |
| components/Workbench/ResultSection.tsx | - | ChartRenderer |
| components/Workbench/SqlWorkspacePanel.tsx | - | DataFlowCanvas |
| services/analysis/adapters/chartJsAdapter.ts | - | shared dependency |
| services/analysis/adapters/dashboardWidgetAdapter.ts | - | shared dependency |
| services/analysis/aiIntent.ts | - | shared dependency |
| services/analysis/chartDisplay.ts | - | shared dependency |
| services/analysis/chartRegistry.ts | - | shared dependency |
| services/analysis/chartWindow.ts | - | shared dependency |
| services/analysis/fieldCatalog.ts | - | shared dependency |
| services/analysis/index.ts | - | shared dependency |
| services/analysis/pipeline.ts | - | shared dependency |
| services/analysis/pivotFilter.ts | - | shared dependency |
| services/analysis/recipes.ts | - | shared dependency |
| services/analysis/scatterSelection.ts | - | shared dependency |
| services/analysis/telemetryCharts.ts | - | shared dependency |
| services/dataflow/logicalFlowForce.ts | d3-force, elkjs/lib/elk.bundled.js | shared dependency |
| services/dataflow/logicalFlowLayout.ts | elkjs/lib/elk.bundled.js, reactflow | shared dependency |
| services/dataflow/logicalRelationFlowParser.ts | reactflow | shared dependency |
| services/dataflow/sqlExecutionPlanParser.ts | dagre | shared dependency |
| services/dataflow/workflowStore.ts | reactflow | shared dependency |
| services/dataflow/workflowTypes.ts | reactflow | shared dependency |
| services/graphLayoutService.ts | dagre, d3 | shared dependency |
| services/graphSimulation.worker.ts | d3-force | shared dependency |
| services/PixiGraphRenderer.ts | pixi.js, d3 | shared dependency |
| services/SimulationEngine.ts | d3, d3 | shared dependency |
| utils/chartPlugins.ts | chart.js | shared dependency |
| utils/chartStyleRules.ts | - | shared dependency |
| utils/chartUtils.ts | chart.js | shared dependency |
| hooks/useOntologyStudioStore.ts | dagre | shared dependency |
| App.tsx | - | DataFlowCanvas |
