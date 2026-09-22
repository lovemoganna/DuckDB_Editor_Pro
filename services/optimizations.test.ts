import { describe, it, expect } from 'vitest';
import { duckDBService } from './duckdbService';
import { ontologyModelingService } from './ontologyModelingService';
import {
  ONTOLOGY_CREATE_STATEMENTS,
  ONTOLOGY_CREATE_TABLES,
} from '../components/Library/ontologyDataModel';

describe('System Optimizations Audit Suite', () => {
  it('Phase 1: checkOPFSSupport and queryArrowZeroCopy method existence', async () => {
    expect(typeof duckDBService.checkOPFSSupport).toBe('function');
    expect(typeof duckDBService.queryArrowZeroCopy).toBe('function');
    
    const opfsRes = await duckDBService.checkOPFSSupport();
    expect(opfsRes).toHaveProperty('supported');
    expect(opfsRes).toHaveProperty('persistent');
  });

  it('Phase 2: compileCanvasToCTE generates topological WITH CTEs cleanly', () => {
    const items = [
      { id: 'node_1', objectId: 1, name: 'Users' },
      { id: 'node_2', objectId: 2, name: 'Orders' },
      { id: 'node_3', objectId: 3, name: 'Analytics' }
    ];
    const edges = [
      { sourceId: 'node_1', targetId: 'node_2' },
      { sourceId: 'node_2', targetId: 'node_3' }
    ];
    
    const sql = ontologyModelingService.compileCanvasToCTE(items, edges);
    expect(sql).toContain('WITH');
    expect(sql).toContain('cte_users AS');
    expect(sql).toContain('cte_orders AS');
    expect(sql).toContain('cte_analytics AS');
    expect(sql).toContain('SELECT * FROM cte_analytics;');
  });

  it('Phase 2: _sys_ontology_canvas_layout table DDL defined', () => {
    expect(ONTOLOGY_CREATE_TABLES).toContain('_sys_ontology_canvas_layout');
    expect(ONTOLOGY_CREATE_TABLES).toContain('object_id VARCHAR PRIMARY KEY');
    expect(ONTOLOGY_CREATE_TABLES).toContain('is_locked BOOLEAN DEFAULT FALSE');
  });

  it('stores structured ontology payloads as WASM-portable text', () => {
    expect(ONTOLOGY_CREATE_TABLES).toContain("properties VARCHAR DEFAULT '{}'");
    expect(ONTOLOGY_CREATE_TABLES).toContain("metadata VARCHAR DEFAULT '{}'");
    expect(ONTOLOGY_CREATE_TABLES).not.toMatch(/\b(properties|metadata)\s+JSON\b/);
  });

  it('uses the WASM-compatible timestamp default for ontology audit records', () => {
    const ddl = ONTOLOGY_CREATE_STATEMENTS.join(';\n');

    expect(ddl).toContain('created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    expect(ddl).not.toContain('created_at DATE DEFAULT CURRENT_DATE');
  });
});
