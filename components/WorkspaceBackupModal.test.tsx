// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceBackupModal } from './WorkspaceBackupModal';
import * as backupService from '../services/completeWorkspaceBackup';

afterEach(cleanup);

describe('WorkspaceBackupModal (BRD index6 Section 6)', () => {
  it('renders export manifest and security notices', () => {
    render(
      <WorkspaceBackupModal
        isOpen={true}
        onClose={vi.fn()}
        onExportWorkspace={vi.fn()}
      />
    );

    expect(screen.getByText('工作区备份与恢复')).toBeTruthy();
    expect(screen.getByText('备份工作区')).toBeTruthy();
    expect(screen.getByText('恢复工作区')).toBeTruthy();

    // Security desensitization notice
    expect(screen.getByText(/凭据安全脱敏/i)).toBeTruthy();
  });

  it('switches to Restore tab and displays upload prompt', async () => {
    render(
      <WorkspaceBackupModal
        isOpen={true}
        onClose={vi.fn()}
        onExportWorkspace={vi.fn()}
      />
    );

    const restoreTab = screen.getByText('恢复工作区');
    fireEvent.click(restoreTab);

    expect(screen.getByText(/选择或拖拽 \.duckdb-workspace 备份文件/i)).toBeTruthy();
  });
});
