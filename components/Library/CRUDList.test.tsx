// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CRUDList } from './CRUDList';

const mockState = {
  initState: 'ready',
  initting: false,
  mapping: { db_name: 'test_db' },
  objectTypes: [
    { id: 1, name: '物理学家', description: 'Physicist' },
  ],
  linkTypes: [
    { id: 10, name: '合作研究', description: 'Collaborates with' },
  ],
  objects: [
    { id: 101, name: '爱因斯坦', object_type_id: 1 },
    { id: 102, name: '波尔', object_type_id: 1 },
  ],
  links: [
    { id: 201, source_object_id: 101, target_object_id: 102, link_type_id: 10 },
  ],
  actions: [
    { id: 301, name: '提出相对论', description: 'Formulate relativity' },
  ],
  introspections: [
    { id: 401, question: '光速是否可变？', answer: '真空光速为定值' },
  ],
  insights: [
    { id: 501, insight: 'E=mc^2', tag: '质能方程' },
  ],
};

const mockStore = {
  state: mockState,
  objectTypeMap: { 1: { id: 1, name: '物理学家' } },
  linkTypeMap: { 10: { id: 10, name: '合作研究' } },
  objectNameMap: { 101: '爱因斯坦', 102: '波尔' },
  refresh: vi.fn().mockResolvedValue(undefined),
  deleteObject: vi.fn().mockResolvedValue(undefined),
  deleteLink: vi.fn().mockResolvedValue(undefined),
  deleteObjectType: vi.fn().mockResolvedValue(undefined),
  deleteLinkType: vi.fn().mockResolvedValue(undefined),
  deleteAction: vi.fn().mockResolvedValue(undefined),
  deleteIntrospection: vi.fn().mockResolvedValue(undefined),
  deleteInsight: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../hooks/useOntologyStore', () => ({
  useOntologyStore: () => mockStore,
}));

vi.mock('../ui/ConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm: vi.fn().mockResolvedValue(true),
  }),
}));

afterEach(() => {
  cleanup();
  delete (window as any).__d3FocusNode;
  delete (window as any).__d3FocusLink;
  delete (window as any).__d3FocusNodes;
  delete (window as any).__d3HoverNode;
});

describe('CRUDList Component & Graph Interaction', () => {
  let mockFocusNode: any;
  let mockFocusLink: any;
  let mockFocusNodes: any;
  let mockHoverNode: any;
  let onInspectMock: any;
  let onRequestDeleteMock: any;

  beforeEach(() => {
    mockFocusNode = vi.fn();
    mockFocusLink = vi.fn();
    mockFocusNodes = vi.fn();
    mockHoverNode = vi.fn();
    onInspectMock = vi.fn();
    onRequestDeleteMock = vi.fn();

    (window as any).__d3FocusNode = mockFocusNode;
    (window as any).__d3FocusLink = mockFocusLink;
    (window as any).__d3FocusNodes = mockFocusNodes;
    (window as any).__d3HoverNode = mockHoverNode;
  });

  it('renders subtabs and switches correctly', () => {
    render(
      <CRUDList 
        onInspect={onInspectMock} 
        onRequestDelete={onRequestDeleteMock} 
      />
    );

    // Initial subtab should be schema
    expect(screen.getByText('物理学家')).toBeInTheDocument();
    expect(screen.getByText('合作研究')).toBeInTheDocument();

    // Switch to instances tab
    const instanceTab = screen.getByRole('tab', { name: /实例/i });
    fireEvent.click(instanceTab);

    expect(screen.getAllByText('爱因斯坦')[0]).toBeInTheDocument();
    expect(screen.getAllByText('波尔')[0]).toBeInTheDocument();
    expect(screen.getByText('提出相对论')).toBeInTheDocument();

    // Switch to reflection tab
    const reflectionTab = screen.getByRole('tab', { name: /沉思/i });
    fireEvent.click(reflectionTab);

    expect(screen.getByText('引导反思')).toBeInTheDocument();
    expect(screen.getByText('洞察记录')).toBeInTheDocument();
  });

  it('triggers onInspect and __d3FocusNode when clicking an ObjectType row', () => {
    render(
      <CRUDList 
        onInspect={onInspectMock} 
        onRequestDelete={onRequestDeleteMock} 
      />
    );

    const otRow = screen.getByText('物理学家');
    fireEvent.click(otRow);

    expect(onInspectMock).toHaveBeenCalledWith('objectType', expect.objectContaining({ id: 1, name: '物理学家' }));
    expect(mockFocusNode).toHaveBeenCalledWith(1, 'typeHub');
  });

  it('triggers onInspect and __d3FocusNode when clicking an Object row in instances tab', () => {
    render(
      <CRUDList 
        onInspect={onInspectMock} 
        onRequestDelete={onRequestDeleteMock} 
      />
    );

    // Switch to instances
    fireEvent.click(screen.getByRole('tab', { name: /实例/i }));

    const objRow = screen.getAllByText('爱因斯坦')[0];
    fireEvent.click(objRow);

    expect(onInspectMock).toHaveBeenCalledWith('object', expect.objectContaining({ id: 101, name: '爱因斯坦' }));
    expect(mockFocusNode).toHaveBeenCalledWith(101, 'instance');
  });

  it('triggers onInspect and __d3FocusLink when clicking a Link row', () => {
    render(
      <CRUDList 
        onInspect={onInspectMock} 
        onRequestDelete={onRequestDeleteMock} 
      />
    );

    // Switch to instances
    fireEvent.click(screen.getByRole('tab', { name: /实例/i }));

    const linkRow = screen.getByText('合作研究');
    fireEvent.click(linkRow);

    expect(onInspectMock).toHaveBeenCalledWith('link', expect.objectContaining({ id: 201 }));
    expect(mockFocusLink).toHaveBeenCalledWith(201, 101, 102);
  });

  it('triggers __d3FocusNodes when clicking "画布同频" button', () => {
    render(
      <CRUDList 
        onInspect={onInspectMock} 
        onRequestDelete={onRequestDeleteMock} 
      />
    );

    // Switch to instances
    fireEvent.click(screen.getByRole('tab', { name: /实例/i }));

    const syncBtn = screen.getByRole('button', { name: /画布同频/i });
    expect(syncBtn).toBeInTheDocument();
    fireEvent.click(syncBtn);

    expect(mockFocusNodes).toHaveBeenCalledWith([101, 102]);
  });

  it('auto switches tab when activeEntity prop is passed', async () => {
    const { rerender } = render(
      <CRUDList 
        onInspect={onInspectMock} 
        onRequestDelete={onRequestDeleteMock} 
        activeEntity={null}
      />
    );

    // Initially schema tab
    expect(screen.getByText('物理学家')).toBeInTheDocument();

    // Rerender with activeEntity pointing to an instance object
    rerender(
      <CRUDList 
        onInspect={onInspectMock} 
        onRequestDelete={onRequestDeleteMock} 
        activeEntity={{ mode: 'object', id: 101 }}
      />
    );

    // Should automatically switch to instances tab
    await waitFor(() => {
      expect(screen.getAllByText('爱因斯坦')[0]).toBeInTheDocument();
    });
  });
});
