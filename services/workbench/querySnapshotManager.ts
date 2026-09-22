/**
 * services/workbench/querySnapshotManager.ts
 *
 * Backend Query Snapshot Manager for DuckDB Workbench (BRD index10.md Section 3.1 & 3.4).
 * Responsibilities:
 * - Store, retrieve, and track immutable QuerySnapshots.
 * - Manage history of snapshots per tab with Undo / Redo support.
 * - Ensure table, inspector, chart, export, and AI layers always consume a consistent snapshot.
 */

import type { QuerySnapshot, TransformationConfig } from './types';
import { transformationEngine } from './transformationEngine';
import { columnProfiler } from './columnProfiler';

export class QuerySnapshotManager {
  private snapshots: Map<string, QuerySnapshot> = new Map();
  private tabSnapshotHistory: Map<string, string[]> = new Map();
  private tabHistoryIndex: Map<string, number> = new Map();

  /**
   * Register a new query execution snapshot
   */
  registerSnapshot(snapshot: QuerySnapshot): void {
    this.snapshots.set(snapshot.snapshotId, snapshot);

    const history = this.tabSnapshotHistory.get(snapshot.tabId) || [];
    const currentIndex = this.tabHistoryIndex.get(snapshot.tabId) ?? (history.length - 1);

    // Truncate future history if branching
    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push(snapshot.snapshotId);

    this.tabSnapshotHistory.set(snapshot.tabId, newHistory);
    this.tabHistoryIndex.set(snapshot.tabId, newHistory.length - 1);
  }

  /**
   * Get all registered snapshots
   */
  getAllSnapshots(): QuerySnapshot[] {
    return Array.from(this.snapshots.values());
  }

  /**
   * Get snapshot by snapshot ID
   */
  getSnapshot(snapshotId: string): QuerySnapshot | undefined {
    return this.snapshots.get(snapshotId);
  }

  /**
   * Get latest active snapshot for a tab
   */
  getActiveSnapshotForTab(tabId: string): QuerySnapshot | undefined {
    const history = this.tabSnapshotHistory.get(tabId);
    if (!history || history.length === 0) return undefined;
    const index = this.tabHistoryIndex.get(tabId) ?? (history.length - 1);
    const snapshotId = history[index];
    return snapshotId ? this.snapshots.get(snapshotId) : undefined;
  }

  /**
   * Derive a new snapshot via transformations
   */
  deriveSnapshot(parentSnapshotId: string, config: TransformationConfig): QuerySnapshot | undefined {
    const parent = this.getSnapshot(parentSnapshotId);
    if (!parent) return undefined;

    const newSnapshotId = `snap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const derived = transformationEngine.applyTransformation(parent, config, newSnapshotId);
    this.registerSnapshot(derived);
    return derived;
  }

  /**
   * Undo transformation on the current tab
   */
  undoTransformation(tabId: string): QuerySnapshot | undefined {
    const history = this.tabSnapshotHistory.get(tabId);
    if (!history || history.length <= 1) return undefined;

    const currentIndex = this.tabHistoryIndex.get(tabId) ?? (history.length - 1);
    if (currentIndex > 0) {
      const nextIndex = currentIndex - 1;
      this.tabHistoryIndex.set(tabId, nextIndex);
      const snapshotId = history[nextIndex];
      return this.snapshots.get(snapshotId);
    }
    return undefined;
  }

  /**
   * Redo transformation on the current tab
   */
  redoTransformation(tabId: string): QuerySnapshot | undefined {
    const history = this.tabSnapshotHistory.get(tabId);
    if (!history) return undefined;

    const currentIndex = this.tabHistoryIndex.get(tabId) ?? (history.length - 1);
    if (currentIndex < history.length - 1) {
      const nextIndex = currentIndex + 1;
      this.tabHistoryIndex.set(tabId, nextIndex);
      const snapshotId = history[nextIndex];
      return this.snapshots.get(snapshotId);
    }
    return undefined;
  }

  /**
   * Mark snapshot for a tab as stale when SQL is modified
   */
  markTabStale(tabId: string, isStale: boolean): void {
    const active = this.getActiveSnapshotForTab(tabId);
    if (active) {
      active.isStale = isStale;
    }
  }

  /**
   * Clear snapshots for a tab or clear all
   */
  clearTab(tabId: string): void {
    const history = this.tabSnapshotHistory.get(tabId) || [];
    for (const snapId of history) {
      this.snapshots.delete(snapId);
      columnProfiler.clearCache(snapId);
    }
    this.tabSnapshotHistory.delete(tabId);
    this.tabHistoryIndex.delete(tabId);
  }

  clearAll(): void {
    this.snapshots.clear();
    this.tabSnapshotHistory.clear();
    this.tabHistoryIndex.clear();
    columnProfiler.clearCache();
  }
}

export const querySnapshotManager = new QuerySnapshotManager();
