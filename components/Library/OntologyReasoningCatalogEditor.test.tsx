import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OntologyReasoningCatalogEditor } from './OntologyReasoningCatalogEditor';

const mocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  loadCatalog: vi.fn(),
  createSnapshot: vi.fn(),
  validateModel: vi.fn(),
  saveCatalog: vi.fn(),
}));

const inferenceMocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  loadWorkspace: vi.fn(),
  validateWorkspace: vi.fn(),
  saveWorkspace: vi.fn(),
}));

vi.mock('../../services/ontology/ontologyReasoningModule', () => ({
  ontologyReasoningModule: mocks,
}));

vi.mock('../../services/ontology/ontologyInferenceModule', () => ({
  ontologyInferenceModule: inferenceMocks,
}));

describe('OntologyReasoningCatalogEditor', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset());
    Object.values(inferenceMocks).forEach(mock => mock.mockReset());
    mocks.initialize.mockResolvedValue(undefined);
    mocks.loadCatalog.mockResolvedValue({ propertyDefinitions: [], rules: [], actionDefinitions: [] });
    mocks.createSnapshot.mockImplementation((_source, catalog) => ({
      snapshotId: 'snapshot',
      ontologyId: 'test',
      objectTypes: [],
      objects: [],
      linkTypes: [],
      links: [],
      catalog,
    }));
    mocks.validateModel.mockReturnValue([]);
    mocks.saveCatalog.mockResolvedValue(undefined);
    inferenceMocks.initialize.mockResolvedValue(undefined);
    inferenceMocks.loadWorkspace.mockResolvedValue({ features: [], rules: [], outcomes: [] });
    inferenceMocks.validateWorkspace.mockResolvedValue(undefined);
    inferenceMocks.saveWorkspace.mockResolvedValue(undefined);
  });

  it('validates and persists structured definitions from the Ontology module', async () => {
    const onClose = vi.fn();
    render(<OntologyReasoningCatalogEditor source={{ objectTypes: [], objects: [], linkTypes: [], links: [], actions: [] }} onClose={onClose} />);
    const editor = await screen.findByLabelText('Ontology 世界变化定义 JSON');
    fireEvent.change(editor, { target: { value: JSON.stringify({
      propertyDefinitions: [],
      rules: [{ id: 'rule.v1', logicalId: 'rule', version: 1, name: '规则', status: 'draft', priority: 0, variables: [], when: { kind: 'and', children: [] }, effects: [] }],
      actionDefinitions: [],
    }) } });
    fireEvent.click(screen.getByRole('button', { name: '校验并保存' }));

    await waitFor(() => expect(mocks.saveCatalog).toHaveBeenCalledWith(expect.objectContaining({
      rules: [expect.objectContaining({ id: 'rule.v1' })],
    })));
    expect(onClose).toHaveBeenCalled();
    expect(inferenceMocks.saveWorkspace).toHaveBeenCalledWith({
      features: [],
      rules: [],
      outcomes: [],
    });
  });
});
