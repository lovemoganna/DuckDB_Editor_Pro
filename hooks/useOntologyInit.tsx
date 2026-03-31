/**
 * useOntologyInit - Centralized ontology initialization state management
 *
 * Problem: Multiple components (CRUDPanel, OntologyGraphView, OntologyPanel)
 * all independently query the 5 ontology tables on mount, causing:
 * - Duplicate "table does not exist" errors flooding the console
 * - Conflicting initialization states between components
 *
 * Solution: Single source of truth for ontology initialization status,
 * shared across all ontology sub-components via React Context.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { duckDBService } from '../services/duckdbService';

const ONTOLOGY_TABLES = ['life_object_type', 'life_object', 'life_link_type', 'life_link', 'life_action'];

interface OntologyInitContextValue {
  isInitialized: boolean | null;  // null = checking, false = not initialized, true = ready
  isInitializing: boolean;
  initError: string | null;
  checkInitialized: () => Promise<void>;
  runInitialization: () => Promise<boolean>;
  needsInitBanner: boolean;  // true when not initialized and we should show banner
}

const OntologyInitContext = createContext<OntologyInitContextValue | null>(null);

export function OntologyInitProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const initInProgressRef = useRef(false);

  // Check which tables actually exist in DuckDB
  const checkInitialized = useCallback(async () => {
    setIsInitialized(null);
    try {
      const tables = await duckDBService.getTables();
      // Check if all 5 ontology tables exist
      const allExist = ONTOLOGY_TABLES.every(t => tables.includes(t));
      setIsInitialized(allExist);
    } catch (e: any) {
      // If we can't even get tables, assume not initialized
      setIsInitialized(false);
    }
  }, []);

  // Run initialization: create tables + insert seed data
  const runInitialization = useCallback(async (): Promise<boolean> => {
    if (initInProgressRef.current) return false;
    if (isInitialized === true) return true;

    initInProgressRef.current = true;
    setIsInitializing(true);
    setInitError(null);

    try {
      // Dynamically import to avoid circular dependency
      const { ONTOLOGY_CREATE_TABLES, ONTOLOGY_SEED_DATA } = await import('../components/Library/ontologyDataModel');

      // Step 1: Create tables
      for (const sql of ONTOLOGY_CREATE_TABLES.split(';')) {
        const trimmed = sql.trim();
        if (!trimmed || trimmed.startsWith('--')) continue;
        try {
          await duckDBService.query(trimmed);
        } catch (e: any) {
          // Ignore "table already exists" errors — they're fine
          if (!e.message?.includes('already exists') && !e.message?.includes('Duplicate')) {
            console.warn('[OntologyInit] Table creation warning:', e.message);
          }
        }
      }

      // Step 2: Insert seed data
      for (const sql of ONTOLOGY_SEED_DATA.split(';')) {
        const trimmed = sql.trim();
        if (!trimmed || trimmed.startsWith('--')) continue;
        try {
          await duckDBService.query(trimmed);
        } catch (e: any) {
          // Ignore duplicate key / already exists errors
          if (!e.message?.includes('already exists') && !e.message?.includes('Duplicate') && !e.message?.includes('constraint')) {
            console.warn('[OntologyInit] Seed data warning:', e.message);
          }
        }
      }

      // Step 3: Verify
      await checkInitialized();
      return true;
    } catch (e: any) {
      setInitError(e.message || '初始化失败');
      return false;
    } finally {
      setIsInitializing(false);
      initInProgressRef.current = false;
    }
  }, [isInitialized, checkInitialized]);

  // Check on mount
  useEffect(() => {
    checkInitialized();
  }, [checkInitialized]);

  const value: OntologyInitContextValue = {
    isInitialized,
    isInitializing,
    initError,
    checkInitialized,
    runInitialization,
    needsInitBanner: isInitialized === false,
  };

  return (
    <OntologyInitContext.Provider value={value}>
      {children}
    </OntologyInitContext.Provider>
  );
}

// Hook to use ontology init state from any child component
export function useOntologyInit(): OntologyInitContextValue {
  const ctx = useContext(OntologyInitContext);
  if (!ctx) {
    throw new Error('useOntologyInit must be used within OntologyInitProvider');
  }
  return ctx;
}

// Legacy compat: standalone check without provider (for components not yet wrapped)
export async function checkOntologyInitialized(): Promise<boolean> {
  try {
    const tables = await duckDBService.getTables();
    return ONTOLOGY_TABLES.every(t => tables.includes(t));
  } catch {
    return false;
  }
}
