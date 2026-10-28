import React, { Suspense, useRef } from 'react';
import { ModalShell } from './Workbench';

/** Load a tool on first use, then retain its instance and unsaved form state. */
export function DeferredTool({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const activated = useRef(false);
  if (open) activated.current = true;
  if (!activated.current) return null;
  return <Suspense fallback={open ? <ModalShell open title="正在打开工具" onClose={onClose}><p role="status" className="py-6 text-sm text-monokai-fg-muted">正在准备，请稍候…</p></ModalShell> : null}>
    {children}
  </Suspense>;
}
