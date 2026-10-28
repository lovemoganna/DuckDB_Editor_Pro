// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OntologyModelingWizard } from './OntologyModelingWizard';

describe('OntologyModelingWizard — AI Ontology Modeling Workbench', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders initial input step with preset scenario templates', () => {
    const onClose = vi.fn();
    const onImport = vi.fn();

    render(<OntologyModelingWizard onClose={onClose} onImport={onImport} />);

    expect(screen.getByText('AI 本体建模工作台 (Ontology Modeling Studio)')).toBeInTheDocument();
    expect(screen.getByText('描述您的真实业务需求或数据')).toBeInTheDocument();
    expect(screen.getByText('🛒 跨境电商与仓储履约')).toBeInTheDocument();
    expect(screen.getByText('🏥 智慧医疗门诊处方')).toBeInTheDocument();
    expect(screen.getByText('开始 AI 业务建模')).toBeInTheDocument();
  });

  it('selects preset scenario, runs AI modeling and transitions to interactive workbench', async () => {
    const onClose = vi.fn();
    const onImport = vi.fn();

    render(<OntologyModelingWizard onClose={onClose} onImport={onImport} />);

    // Click on preset scenario
    fireEvent.click(screen.getByText('🛒 跨境电商与仓储履约'));

    // Start modeling
    const startBtn = screen.getByText('开始 AI 业务建模');
    fireEvent.click(startBtn);

    // Should transition to step 2 Workbench
    await waitFor(() => {
      expect(screen.getByText('动态本体图谱预览')).toBeInTheDocument();
    });

    // Check four elements and rationale are present
    expect(screen.getByText('· 建模设计依据：')).toBeInTheDocument();
    expect(screen.getByText('自动体检修复')).toBeInTheDocument();
    expect(screen.getByTestId('enter-commit-step-btn')).toBeInTheDocument();
  });

  it('supports switching tabs in workbench, editing entities, and committing to ontology graph', async () => {
    const onClose = vi.fn();
    const onImport = vi.fn().mockResolvedValue(undefined);

    render(<OntologyModelingWizard onClose={onClose} onImport={onImport} />);

    // Enter custom business description
    const textarea = screen.getByPlaceholderText(/例如：跨境电商履约体系/);
    fireEvent.change(textarea, { target: { value: '医院门诊挂号就诊处方开具与药品发放' } });

    fireEvent.click(screen.getByText('开始 AI 业务建模'));

    await waitFor(() => {
      expect(screen.getByText('动态本体图谱预览')).toBeInTheDocument();
    });

    // Switch to Actions tab
    const actionTab = screen.getByRole('button', { name: /^行动/ });
    fireEvent.click(actionTab);
    expect(screen.getByText(/新建Action/)).toBeInTheDocument();

    // Switch to Links tab and edit a relation
    const linksTab = screen.getByRole('button', { name: /^关系/ });
    fireEvent.click(linksTab);
    expect(screen.getByText(/新建关联/)).toBeInTheDocument();
    const verbInputs = screen.getAllByPlaceholderText('动词(如 下单)');
    if (verbInputs.length > 0) {
      fireEvent.change(verbInputs[0], { target: { value: '开具处方' } });
    }

    // Switch to Verification tab
    const verifyTab = screen.getByRole('button', { name: /^示例/ });
    fireEvent.click(verifyTab);
    expect(screen.getByText(/场景实例验证层/)).toBeInTheDocument();

    // Switch to Diagnostics tab
    const diagTab = screen.getByRole('button', { name: /^体检/ });
    fireEvent.click(diagTab);
    expect(screen.getByText(/模型拓扑健康指数/)).toBeInTheDocument();

    // Click "写入本体图谱" button using testid to go to step 3
    const writeBtn = screen.getByTestId('enter-commit-step-btn');
    fireEvent.click(writeBtn);

    await waitFor(() => {
      expect(screen.getByText('确认写入本体知识图谱')).toBeInTheDocument();
      expect(screen.getByText(/增量合并写入/)).toBeInTheDocument();
      expect(screen.getByText(/全新覆盖写入/)).toBeInTheDocument();
    });

    // Commit import
    const commitBtn = screen.getByText('确认写入本体图谱');
    fireEvent.click(commitBtn);

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith(
        expect.objectContaining({
          objects: expect.any(Array),
          links: expect.any(Array),
          actions: expect.any(Array),
        }),
        { replace: false }
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('supports node point-and-edit, node merging, and local regeneration', async () => {
    const onClose = vi.fn();
    const onImport = vi.fn().mockResolvedValue(undefined);

    render(<OntologyModelingWizard onClose={onClose} onImport={onImport} />);

    fireEvent.click(screen.getByText('🛒 跨境电商与仓储履约'));
    fireEvent.click(screen.getByText('开始 AI 业务建模'));

    await waitFor(() => {
      expect(screen.getByText('动态本体图谱预览')).toBeInTheDocument();
    });

    // Verify Point-and-edit card is visible for the initial selected object
    expect(screen.getByText(/正在编辑节点:/)).toBeInTheDocument();
    expect(screen.getByText('重新推导该节点')).toBeInTheDocument();

    // Click local node regeneration
    fireEvent.click(screen.getByText('重新推导该节点'));
    await waitFor(() => {
      expect(screen.getByText(/正在编辑节点:/)).toBeInTheDocument();
    });

    // Test node merge: select a target node and confirm merge
    const mergeSelects = screen.getAllByRole('combobox');
    const mergePicker = mergeSelects.find(s => (s as HTMLSelectElement).innerHTML.includes('合并至...'));
    if (mergePicker) {
      const options = Array.from((mergePicker as HTMLSelectElement).options);
      if (options.length > 1) {
        fireEvent.change(mergePicker, { target: { value: options[1].value } });
        const confirmMergeBtn = screen.getByText('确认');
        fireEvent.click(confirmMergeBtn);
      }
    }

    // Verify auto-fix button can be clicked
    const autoFixBtn = screen.getByText('一键自动修复防错');
    fireEvent.click(autoFixBtn);
    // Repair/regeneration suggestions are now explicit; rejecting keeps the edited draft.
    screen.queryAllByRole('button', { name: /^拒绝 / }).forEach(button => fireEvent.click(button));

    // Verify commit in overwrite mode
    const writeBtn = screen.getByTestId('enter-commit-step-btn');
    fireEvent.click(writeBtn);

    await waitFor(() => {
      expect(screen.getByText(/全新覆盖写入/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/全新覆盖写入/));
    fireEvent.click(screen.getByText('确认写入本体图谱'));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith(
        expect.anything(),
        { replace: true }
      );
    });
  });
});

describe('OntologyModelingWizard — manual and AI shared draft', () => {
  it('creates schema from a blank canvas, connects nodes, preserves mode switches and commits no fake instances', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    render(<OntologyModelingWizard onClose={vi.fn()} onImport={onImport} />);
    fireEvent.click(screen.getByRole('button', { name: '手动建模' }));
    expect(screen.getByRole('status')).toHaveTextContent('0 真实实例');
    fireEvent.doubleClick(screen.getByLabelText('本体类型建模画布'));
    fireEvent.change(screen.getByLabelText('对象名称'), { target: { value: 'Customer' } });
    fireEvent.change(screen.getByLabelText('对象标识符'), { target: { value: 'customer' } });
    fireEvent.click(screen.getByTitle('新增对象类型 (Object Type)'));
    fireEvent.change(screen.getByLabelText('对象名称'), { target: { value: 'Order' } });
    fireEvent.mouseDown(screen.getByTestId('modeling-node-Customer'), { shiftKey: true });
    fireEvent.mouseDown(screen.getByTestId('modeling-node-Order'), { shiftKey: true });
    expect(screen.getByRole('status')).toHaveTextContent('2 类型');
    fireEvent.click(screen.getByRole('button', { name: 'AI 辅助建模' }));
    fireEvent.click(screen.getByRole('button', { name: '手动建模' }));
    expect(screen.getByTestId('modeling-node-Customer')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('enter-commit-step-btn'));
    fireEvent.click(screen.getByText('确认写入本体图谱'));
    await waitFor(() => expect(onImport).toHaveBeenCalled());
    const result = onImport.mock.calls[0][0];
    expect(result.objects).toEqual([]); expect(result.links).toEqual([]);
    expect(result.linkTypes[0]).toMatchObject({ fromType: 'Customer', toType: 'Order' });
  });
  it('blocks invalid identifiers and cancels deletion without changing the formal version', async () => {
    const onImport = vi.fn(), onClose = vi.fn();
    render(<OntologyModelingWizard onClose={onClose} onImport={onImport} />);
    fireEvent.click(screen.getByRole('button', { name: '手动建模' }));
    fireEvent.click(screen.getByTitle('新增对象类型 (Object Type)'));
    fireEvent.change(screen.getByLabelText('对象标识符'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('enter-commit-step-btn'));
    expect(screen.getByText('校验失败，请在体检诊断中定位并修正错误。')).toBeInTheDocument();
    expect(onImport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('删除对象类型'));
    expect(screen.getByRole('alertdialog', { name: '删除影响范围' })).toHaveTextContent('实例');
    fireEvent.click(screen.getByText('取消删除'));
    expect(screen.getByTestId('modeling-node-NewEntity')).toBeInTheDocument();
    fireEvent.click(screen.getByText('取消未保存修改'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('确认放弃修改'));
    expect(onClose).toHaveBeenCalled(); expect(onImport).not.toHaveBeenCalled();
  });
});
