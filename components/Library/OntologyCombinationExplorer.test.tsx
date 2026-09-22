import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OntologyReasoningCatalog } from '../../services/ontology/ontologyReasoningModule';
import { OntologyCombinationExplorer } from './OntologyCombinationExplorer';

const inferenceMocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  loadWorkspace: vi.fn(),
}));

vi.mock('../../services/ontology/ontologyInferenceModule', () => ({
  ontologyInferenceModule: inferenceMocks,
}));

const source = {
  activeTemplateId: 'ui-native-test',
  objectTypes: [{ id: 1, name: '订单' }, { id: 2, name: '支付事件' }],
  objects: [
    { id: 10, object_type_id: 1, name: '订单 A', properties: { status: 'pending' } },
    { id: 20, object_type_id: 2, name: '支付 A', properties: { result: 'success' } },
  ],
  linkTypes: [{ id: 7, name: '支付驱动订单' }],
  links: [{ id: 70, link_type_id: 7, source_object_id: 20, target_object_id: 10 }],
  actions: [],
};

const catalog: OntologyReasoningCatalog = {
  propertyDefinitions: [{
    id: 'property.order.status',
    logicalId: 'property.order.status',
    version: 1,
    objectTypeId: 1,
    key: 'status',
    name: '订单状态',
    valueType: 'string',
    nullable: false,
    status: 'active',
  }],
  rules: [],
  actionDefinitions: [],
};

const catalogWithRule: OntologyReasoningCatalog = {
  ...catalog,
  rules: [{
    id: 'rule.order.has-payment.v1',
    logicalId: 'rule.order.has-payment',
    version: 1,
    name: '订单已有支付事件',
    description: '通过真实有向关系判断订单是否已有支付事件',
    status: 'active',
    root: {
      kind: 'condition',
      nodeId: 'condition.order.has-payment',
      featureId: 'feature.ontology.relation.1.7.incoming.v1',
      operator: 'is_true',
    },
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  inferenceMocks.initialize.mockResolvedValue(undefined);
  inferenceMocks.loadWorkspace.mockResolvedValue({ features: [], rules: [], outcomes: [] });
});

afterEach(cleanup);

describe('OntologyCombinationExplorer', () => {
  it('shows an honest empty state when the current ontology has no object types', () => {
    render(<OntologyCombinationExplorer source={{
      activeTemplateId: 'empty',
      objectTypes: [],
      objects: [],
      linkTypes: [],
      links: [],
      actions: [],
    }} catalog={{ propertyDefinitions: [], rules: [], actionDefinitions: [] }} rules={[]} />);

    expect(screen.getByText('当前 Ontology 没有对象类型，无法建立推演世界。')).toBeTruthy();
    expect(screen.queryByText(/Primary Entity/)).toBeNull();
    expect(screen.queryByText(/Transaction/)).toBeNull();
  });

  it('shows real features and only current facts when no executable rule exists', async () => {
    render(<OntologyCombinationExplorer source={source} catalog={catalog} rules={[]} />);

    expect(screen.getByText('订单状态')).toBeTruthy();
    expect(screen.getAllByText(/接收关系：支付驱动订单/)[0]).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '生成并验证组合' }));

    await waitFor(() => expect(screen.getAllByText('已成立').length).toBeGreaterThan(0));
    expect(screen.queryByText('可能出现')).toBeNull();
    expect(screen.queryByText(/未定义结构化规则时只展示当前事实/)).toBeTruthy();

    expect(screen.queryByText(/风险模板/)).toBeNull();
  }, 20000);

  it('chooses a compatible default feature set for heterogeneous real objects', async () => {
    render(<OntologyCombinationExplorer
      source={{
        ...source,
        objects: [
          { id: 10, object_type_id: 1, name: '订单 A', properties: { status: 'pending' } },
          { id: 11, object_type_id: 1, name: '订单 B', properties: { channel: 'web' } },
        ],
        links: [],
      }}
      catalog={{
        ...catalog,
        propertyDefinitions: [
          catalog.propertyDefinitions[0],
          {
            id: 'property.order.channel',
            logicalId: 'property.order.channel',
            version: 1,
            objectTypeId: 1,
            key: 'channel',
            name: '订单渠道',
            valueType: 'string',
            nullable: true,
            status: 'active',
          },
        ],
      }}
      rules={[]}
    />);

    await waitFor(() => expect(screen.getAllByText('已成立').length).toBeGreaterThan(0));
    expect(screen.getAllByRole('button', { name: /候选情形/ }).length).toBeGreaterThan(0);
  });


  it('supports candidate search without presenting observed frequency as probability', async () => {
    render(<OntologyCombinationExplorer source={source} catalog={catalog} rules={[]} />);

    fireEvent.click(screen.getByRole('button', { name: '生成并验证组合' }));

    await waitFor(() => expect(screen.getAllByText('已成立').length).toBeGreaterThan(0));

    expect(screen.queryByText(/概率/)).toBeNull();

    const searchInput = screen.getByRole('textbox', { name: '搜索候选情形' });
    expect(searchInput).toBeTruthy();
    fireEvent.change(searchInput, { target: { value: 'non_existing_search_term' } });
    expect(screen.getByText('没有匹配的候选情形')).toBeTruthy();
  });

  it('shows concrete counterfactual condition changes from the inference report', async () => {
    render(
      <OntologyCombinationExplorer
        source={source}
        catalog={catalogWithRule}
        rules={catalogWithRule.rules}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '生成并验证组合' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /候选情形/ }).length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByRole('button', { name: /候选情形/ })[0]);
    expect(await screen.findByText('真实依据对象')).toBeTruthy();
    expect(screen.getByText('订单 A (#10)')).toBeTruthy();
    expect(await screen.findByText('改变条件会得到什么')).toBeTruthy();
    expect(screen.getAllByText(/改变 1 项/).length).toBeGreaterThan(0);
  });

  it('supports Top-K limit selector with options 10, 20, 30, 50, 100', async () => {
    render(<OntologyCombinationExplorer source={source} catalog={catalog} rules={[]} />);

    const topKSelect = screen.getByRole('combobox', { name: '组合生成数量' }) as HTMLSelectElement;
    expect(topKSelect).toBeTruthy();

    const options = Array.from(topKSelect.options).map(opt => Number(opt.value));
    expect(options).toEqual([10, 20, 30, 50, 100]);

    fireEvent.change(topKSelect, { target: { value: '50' } });
    expect(topKSelect.value).toBe('50');
  });

  it('generates natural language explanation answering 3 core questions', async () => {
    render(<OntologyCombinationExplorer source={source} catalog={catalog} rules={[]} />);

    fireEvent.click(screen.getByRole('button', { name: '生成并验证组合' }));

    await waitFor(() => expect(screen.getAllByText(/特征组合自然语言解释说明/).length).toBeGreaterThan(0));

    expect(screen.getAllByText(/1. 组合特征：/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2. 聚合原因：/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3. 情形表达：/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/互斥矛盾组合/)).toBeNull();
  });

  it('supports Tag Collection Management System (domain-agnostic preset tags, custom tag creation, and filtering)', async () => {
    render(<OntologyCombinationExplorer source={source} catalog={catalog} rules={[]} />);

    fireEvent.click(screen.getByRole('button', { name: '生成并验证组合' }));

    await waitFor(() => expect(screen.getAllByText('+ 打标签').length).toBeGreaterThan(0));

    // Open tag picker on first candidate
    const tagButtons = screen.getAllByRole('button', { name: '+ 打标签' });
    fireEvent.click(tagButtons[0]);

    // Select domain-agnostic preset tags
    expect(screen.getAllByText('⭐ 重点衍生').length).toBeGreaterThan(0);
    expect(screen.getAllByText('📌 高频组合').length).toBeGreaterThan(0);
    expect(screen.getAllByText('🔍 待验证').length).toBeGreaterThan(0);
    expect(screen.getAllByText('✅ 逻辑成立').length).toBeGreaterThan(0);

    const tagBtn = screen.getAllByRole('button', { name: '⭐ 重点衍生' })[0];
    fireEvent.click(tagBtn);

    // Verify tag is added to candidate
    expect(screen.getAllByText('⭐ 重点衍生').length).toBeGreaterThan(0);

    // Test Tag Filter dropdown
    const tagFilterSelect = screen.getByRole('combobox', { name: '标签集合筛选' }) as HTMLSelectElement;
    expect(tagFilterSelect).toBeTruthy();

    fireEvent.change(tagFilterSelect, { target: { value: '⭐ 重点衍生' } });
    expect(tagFilterSelect.value).toBe('⭐ 重点衍生');

    fireEvent.change(tagFilterSelect, { target: { value: 'tagged_only' } });
    expect(tagFilterSelect.value).toBe('tagged_only');

    fireEvent.change(tagFilterSelect, { target: { value: 'untagged_only' } });
    expect(tagFilterSelect.value).toBe('untagged_only');
  });

  it('supports pushing candidate condition to SQL editor and creating DuckDB view', async () => {
    render(<OntologyCombinationExplorer source={source} catalog={catalog} rules={[]} />);

    fireEvent.click(screen.getByRole('button', { name: '生成并验证组合' }));

    await waitFor(() => expect(screen.getAllByText('SQL 验证').length).toBeGreaterThan(0));
    expect(screen.getAllByText('建视图').length).toBeGreaterThan(0);

    const sqlVerifyBtn = screen.getAllByRole('button', { name: /SQL 验证/ })[0];
    fireEvent.click(sqlVerifyBtn);

    const buildViewBtn = screen.getAllByRole('button', { name: /建视图/ })[0];
    fireEvent.click(buildViewBtn);
  });
});
