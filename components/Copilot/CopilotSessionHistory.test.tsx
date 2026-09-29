// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CopilotSessionHistory } from './CopilotSessionHistory';
import { useCopilotStore } from '../../hooks/store/useCopilotStore';

describe('CopilotSessionHistory', () => {
  beforeEach(() => {
    useCopilotStore.setState({
      showSessionHistory: true,
      sessionsHydrated: true,
      activeSessionId: 'cps-1',
      isGenerating: false,
      sessions: [
        {
          id: 'cps-1',
          name: '当前会话',
          createdAt: Date.now() - 120_000,
          updatedAt: Date.now() - 60_000,
          messageCount: 3,
          preview: '最近一条用户问题',
        },
        {
          id: 'cps-2',
          name: '更早的会话',
          createdAt: Date.now() - 86400_000,
          updatedAt: Date.now() - 86000_000,
          messageCount: 8,
          preview: '旧问题摘要',
        },
      ],
      switchSession: vi.fn(async () => undefined),
      renameSession: vi.fn(async () => undefined),
      deleteSession: vi.fn(async () => undefined),
      createNewSession: vi.fn(async () => undefined),
      setShowSessionHistory: (open: boolean) => useCopilotStore.setState({ showSessionHistory: open }),
    } as any);
  });

  it('renders session list and closes panel', () => {
    render(<CopilotSessionHistory />);
    expect(screen.getByLabelText('会话历史')).toBeInTheDocument();
    expect(screen.getByText('当前会话')).toBeInTheDocument();
    expect(screen.getByText('更早的会话')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('关闭会话历史'));
    expect(useCopilotStore.getState().showSessionHistory).toBe(false);
  });

  it('invokes switchSession when selecting another session', () => {
    const switchSession = vi.fn(async () => undefined);
    useCopilotStore.setState({ switchSession } as any);
    render(<CopilotSessionHistory />);
    fireEvent.click(screen.getByText('更早的会话'));
    expect(switchSession).toHaveBeenCalledWith('cps-2');
  });

  it('closes history when selecting the already-active session', async () => {
    const realSwitch = useCopilotStore.getState().switchSession;
    // Use store implementation via reassign after seeding ids
    useCopilotStore.setState({
      switchSession: async (id: string) => {
        if (useCopilotStore.getState().activeSessionId === id) {
          useCopilotStore.setState({ showSessionHistory: false });
          return;
        }
        await realSwitch(id);
      },
    } as any);
    render(<CopilotSessionHistory />);
    fireEvent.click(screen.getByText('当前会话'));
    expect(useCopilotStore.getState().showSessionHistory).toBe(false);
  });
});
