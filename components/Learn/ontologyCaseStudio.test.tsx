import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { 
  PRESET_MODELING_CASES, compileDuckDbSql, computeAuditReport 
} from './data/mockCaseData';
import { OntologyMethodologyView } from './OntologyMethodologyView';
import { OntologyCaseStudio } from './OntologyCaseStudio';
import { OntologyInspectorConsole } from './OntologyInspectorConsole';
import { UnifiedLearnExplorer } from './UnifiedLearnExplorer';

describe('Ontology Preset Cases & Mock Data', () => {
  it('contains the flagship Shunda Cold Chain case and smart hospital case', () => {
    expect(PRESET_MODELING_CASES.length).toBeGreaterThanOrEqual(2);
    
    const shundaCase = PRESET_MODELING_CASES.find(c => c.id === 'case-coldchain-shunda');
    expect(shundaCase).toBeDefined();
    expect(shundaCase?.title).toContain('顺达冷链');
    expect(shundaCase?.businessBackground).toContain('冰鲜三文鱼');
    expect(shundaCase?.businessDilemmas.length).toBeGreaterThanOrEqual(3);

    // Verify OPLA integrity
    const model = shundaCase!.referenceModel;
    expect(model.objects.length).toBeGreaterThanOrEqual(4);
    expect(model.links.length).toBeGreaterThanOrEqual(3);
    expect(model.actions.length).toBeGreaterThanOrEqual(3);

    // Objects have primary keys and properties
    model.objects.forEach(obj => {
      expect(obj.primaryKey).toBeTruthy();
      expect(obj.properties.length).toBeGreaterThan(0);
      expect(obj.displayName).toBeTruthy();
    });

    // Links have predicates
    model.links.forEach(link => {
      expect(link.predicate).toBeTruthy();
      expect(link.sourceObjectId).toBeTruthy();
      expect(link.targetObjectId).toBeTruthy();
    });

    // Actions have preconditions and mutations
    model.actions.forEach(act => {
      expect(act.actor).toBeTruthy();
      expect(act.preconditions).toBeTruthy();
      expect(act.mutation).toBeTruthy();
      expect(act.auditEvent).toBeTruthy();
    });

    // SQL statement sanity
    const sql = compileDuckDbSql(shundaCase!);
    expect(sql).toContain('CREATE OR REPLACE TABLE obj_shipment_order');
    expect(sql).toContain('CREATE OR REPLACE TABLE link_transported_by');
    expect(sql).toContain('CREATE OR REPLACE TABLE action_execution_log');

    // Audit report sanity
    const audit = computeAuditReport(shundaCase!);
    expect(audit.score).toBeGreaterThanOrEqual(80);
    expect(audit.isPassing).toBe(true);
  });
});

describe('OntologyMethodologyView Component', () => {
  it('renders OPLA mental model and decision compass', () => {
    const onStartWorkshop = vi.fn();
    const onExploreCurriculum = vi.fn();

    render(
      <OntologyMethodologyView
        onStartWorkshop={onStartWorkshop}
        onExploreCurriculum={onExploreCurriculum}
      />
    );

    expect(screen.getByText(/OPLA 本体四步思考法/i)).toBeInTheDocument();
    expect(screen.getByText('Object 实体')).toBeInTheDocument();
    expect(screen.getByText('Property 属性')).toBeInTheDocument();
    expect(screen.getByText('Link 关系拓扑')).toBeInTheDocument();
    expect(screen.getByText('Action 业务闭环')).toBeInTheDocument();

    const ctaButtons = screen.getAllByText(/进入【顺达冷链】OPLA 独立建模工坊实操/i);
    expect(ctaButtons.length).toBeGreaterThan(0);
    fireEvent.click(ctaButtons[0]);
    expect(onStartWorkshop).toHaveBeenCalledWith('case-coldchain-shunda');
  });

  it('supports answering interactive quiz questions with feedback', () => {
    render(
      <OntologyMethodologyView
        onStartWorkshop={vi.fn()}
        onExploreCurriculum={vi.fn()}
      />
    );

    const optionB = screen.getByText(/抽象为一个独立的事件型对象/i);
    fireEvent.click(optionB);

    expect(screen.getByText('回答正确！')).toBeInTheDocument();
    expect(screen.getByText(/温超事故本身具有不可篡改的发生时间/i)).toBeInTheDocument();
  });
});

describe('Unified OPLA Four-Pillar Board & Canvas', () => {
  it('renders 4-pillar columns (Objects, Properties, Links, Actions) and topology canvas', () => {
    const caseData = PRESET_MODELING_CASES[0];
    const onChangeCase = vi.fn();
    const onSelectObject = vi.fn();

    render(
      <OntologyCaseStudio
        currentCase={caseData}
        onChangeCase={onChangeCase}
        selectedObjectId={caseData.referenceModel.objects[0].id}
        onSelectObject={onSelectObject}
      />
    );

    // Verify 4-pillar headers
    expect(screen.getByText(/1\. Objects 实体/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Properties 属性度量/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Links 关系/i)).toBeInTheDocument();
    expect(screen.getByText(/4\. Actions 闭环/i)).toBeInTheDocument();

    // Verify entities are rendered
    expect(screen.getAllByText('货运订单').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('冷藏货车').length).toBeGreaterThanOrEqual(1);

    // Verify SVG topology canvas text
    expect(screen.getByText(/OPLA 拓扑实时渲染视窗/i)).toBeInTheDocument();
  });

  it('renders OntologyInspectorConsole with health score and live SQL preview', () => {
    const caseData = PRESET_MODELING_CASES[0];
    const sql = compileDuckDbSql(caseData);
    const audit = computeAuditReport(caseData);

    render(
      <OntologyInspectorConsole
        currentCase={caseData}
        generatedSql={sql}
        auditReport={audit}
      />
    );

    expect(screen.getByText(/审查与执行控制台/i)).toBeInTheDocument();
    expect(screen.getByText(/立即在 DuckDB 运行验证/i)).toBeInTheDocument();
    expect(screen.getByText(/live_compiled_model\.sql/i)).toBeInTheDocument();
  });

  it('renders UnifiedLearnExplorer tree structure', () => {
    const onSelect = vi.fn();

    render(
      <UnifiedLearnExplorer
        currentSelection={{ type: 'methodology' }}
        onSelect={onSelect}
        ontologyProgress={{}}
      />
    );

    expect(screen.getByText('认知方法论')).toBeInTheDocument();
    expect(screen.getByText('OPLA 独立工坊')).toBeInTheDocument();
    expect(screen.getByText('14 课故事体系')).toBeInTheDocument();
    expect(screen.getByText('OPLA 四步思考法全景')).toBeInTheDocument();
  });
});
