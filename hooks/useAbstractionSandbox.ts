/**
 * useAbstractionSandbox — 实验台状态 Hook（完善版）
 *
 * 核心职责：
 * - 管理实验台编辑器状态（SQL / 结果 / Tab）
 * - 草稿自动保存（localStorage）
 * - 版本历史管理（localStorage）
 * - 保存为模板功能
 * - 执行成功后自动保存版本历史
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAnalysisHubStore, useAbstractionStore } from './store/analysisHubStore';

const DRAFT_STORAGE_KEY = 'abstraction-draft';
const VERSIONS_STORE_KEY = 'abstraction-versions';

export interface SandboxDraft {
  id: string;
  sql: string;
  name: string;
  updatedAt: number;
}

export interface SandboxVersion {
  id: string;
  templateId?: string;
  sql: string;
  name: string;
  note: string;
  createdAt: number;
}

export const useAbstractionSandbox = () => {
  const sandboxSql = useAbstractionStore(s => s.sandboxSql);
  const sandboxResult = useAbstractionStore(s => s.sandboxResult);
  const sandboxError = useAbstractionStore(s => s.sandboxError);
  const sandboxTab = useAbstractionStore(s => s.sandboxTab);
  const sandboxDraftName = useAbstractionStore(s => s.sandboxDraftName);
  const isGenerating = useAbstractionStore(s => s.isGenerating);
  const aiRequest = useAbstractionStore(s => s.aiRequest);

  const setSandboxSql = useAbstractionStore(s => s.setSandboxSql);
  const setSandboxResult = useAbstractionStore(s => s.setSandboxResult);
  const setSandboxError = useAbstractionStore(s => s.setSandboxError);
  const setSandboxTab = useAbstractionStore(s => s.setSandboxTab);
  const setSandboxDraftName = useAbstractionStore(s => s.setSandboxDraftName);
  const executeSandboxSQL = useAbstractionStore(s => s.executeSandboxSQL);
  const saveSandboxAsTemplate = useAbstractionStore(s => s.saveSandboxAsTemplate);
  const clearSandbox = useAbstractionStore(s => s.clearSandbox);
  const addTable = useAbstractionStore(s => s.addTable);

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevResultRef = useRef(sandboxResult);
  const prevErrorRef = useRef(sandboxError);

  // ── 版本历史工具 ──
  const getVersionsFromStorage = (): SandboxVersion[] => {
    try {
      const raw = localStorage.getItem(VERSIONS_STORE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const saveVersionToStorage = (note: string = '') => {
    if (!sandboxSql.trim()) return;
    const versions = getVersionsFromStorage();
    const newVersion: SandboxVersion = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sql: sandboxSql,
      name: sandboxDraftName,
      note,
      createdAt: Date.now(),
    };
    versions.unshift(newVersion);
    if (versions.length > 50) versions.length = 50;
    localStorage.setItem(VERSIONS_STORE_KEY, JSON.stringify(versions));
  };

  // ── 执行成功时自动保存版本 ──
  useEffect(() => {
    const prevResult = prevResultRef.current;
    const prevError = prevErrorRef.current;
    // 检测到 sandboxResult 从 null → 有值（且无错误），说明执行成功
    if (sandboxResult !== null && prevResult === null && !sandboxError) {
      saveVersionToStorage();
    }
    prevResultRef.current = sandboxResult;
    prevErrorRef.current = sandboxError;
  }, [sandboxResult, sandboxError]);

  // ── 草稿自动恢复 ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const draft: SandboxDraft = JSON.parse(saved);
        setSandboxSql(draft.sql);
        setSandboxDraftName(draft.name);
      }
    } catch {
      // ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 草稿自动保存（防抖 1s） ──
  const saveDraft = useCallback(() => {
    if (sandboxSql.trim()) {
      const draft: SandboxDraft = {
        id: 'current',
        sql: sandboxSql,
        name: sandboxDraftName,
        updatedAt: Date.now(),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }
  }, [sandboxSql, sandboxDraftName]);

  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(saveDraft, 1000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [sandboxSql, sandboxDraftName, saveDraft]);

  // ── 手动保存草稿 ──
  const manualSaveDraft = useCallback(() => {
    saveDraft();
  }, [saveDraft]);

  // ── 清空草稿 ──
  const handleClearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    clearSandbox();
  }, [clearSandbox]);

  // ── 执行 SQL ──
  const handleExecute = useCallback(async () => {
    if (!sandboxSql.trim()) return;
    await executeSandboxSQL(sandboxSql);
    // 版本在 useEffect 中自动保存（检测 sandboxResult 变化）
  }, [sandboxSql, executeSandboxSQL]);

  // ── 保存为模板 ──
  const handleSaveAsTemplate = useCallback(async (name: string, domain: string) => {
    await saveSandboxAsTemplate(name, domain);
  }, [saveSandboxAsTemplate]);

  // ── 版本历史 ──
  const saveVersion = useCallback((note: string = '') => {
    saveVersionToStorage(note);
  }, []);

  const getVersions = useCallback((): SandboxVersion[] => {
    return getVersionsFromStorage();
  }, []);

  const restoreVersion = useCallback((version: SandboxVersion) => {
    setSandboxSql(version.sql);
    setSandboxDraftName(version.name);
  }, [setSandboxSql, setSandboxDraftName]);

  const clearVersions = useCallback(() => {
    localStorage.removeItem(VERSIONS_STORE_KEY);
  }, []);

  return {
    // 状态
    sandboxSql,
    sandboxResult,
    sandboxError,
    sandboxTab,
    sandboxDraftName,
    isExecuting: isGenerating,

    // 操作
    setSql: setSandboxSql,
    setResult: setSandboxResult,
    setError: setSandboxError,
    setTab: setSandboxTab,
    setDraftName: setSandboxDraftName,

    // 功能
    handleExecute,
    handleSaveAsTemplate,
    handleClearDraft,
    manualSaveDraft,

    // 版本历史
    saveVersion,
    getVersions,
    restoreVersion,
    clearVersions,
  };
};

