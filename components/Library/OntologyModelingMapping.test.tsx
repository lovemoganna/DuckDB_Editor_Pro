import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyModelingDraft } from '../../services/ontologyModelingDraft';
import { OntologyModelingMapping } from './OntologyModelingMapping';

const mocks = vi.hoisted(() => ({ query: vi.fn(), preview: vi.fn() }));
vi.mock('../../services/duckdbService', () => ({ duckDBService: { query: mocks.query } }));
vi.mock('../../services/ontologyModelingDraft', async importOriginal => ({
  ...await importOriginal<typeof import('../../services/ontologyModelingDraft')>(), queryModelingInstances: mocks.preview,
}));

describe('real data preview editing boundary', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.query.mockResolvedValue([]); });
  const draft = () => ({ ...emptyModelingDraft(), objectTypes: [{ name: 'Customer', description: '',
    mapping: { catalog: 'db', schema: 'main', table: 'customers', idField: 'id', properties: {} } }] });
  it('keeps manual edits made while a query is running', async () => {
    const initial = draft(), onChange = vi.fn();
    let resolve!: (value: typeof initial) => void;
    mocks.preview.mockReturnValue(new Promise(r => { resolve = r; }));
    const { rerender } = render(<OntologyModelingMapping draft={initial} selectedTypeName="Customer" onChange={onChange} />);
    await waitFor(() => expect(mocks.query).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: '查询并预览真实实例' }));
    const edited = { ...initial, objectTypes: [{ ...initial.objectTypes[0], description: 'manual edit' }] };
    rerender(<OntologyModelingMapping draft={edited} selectedTypeName="Customer" onChange={onChange} />);
    await act(async () => resolve(initial));
    expect(screen.getByRole('alert').textContent).toContain('草案已变化');
    expect(onChange).not.toHaveBeenCalled();
  });
  it('ignores a completed query after leaving the mapping editor', async () => {
    const initial = draft(), onChange = vi.fn();
    let resolve!: (value: typeof initial) => void;
    mocks.preview.mockReturnValue(new Promise(r => { resolve = r; }));
    const { unmount } = render(<OntologyModelingMapping draft={initial} selectedTypeName="Customer" onChange={onChange} />);
    await waitFor(() => expect(mocks.query).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: '查询并预览真实实例' }));
    unmount();
    await act(async () => resolve(initial));
    expect(onChange).not.toHaveBeenCalled();
  });
});
