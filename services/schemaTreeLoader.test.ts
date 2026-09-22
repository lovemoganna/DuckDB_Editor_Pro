import { describe, expect, it, vi } from 'vitest';
import { ColumnInfo } from '../types';
import { loadSchemaTree } from './schemaTreeLoader';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('loadSchemaTree', () => {
  it('starts every table load in parallel and preserves partial successes', async () => {
    const first = deferred<ColumnInfo[]>();
    const second = deferred<ColumnInfo[]>();
    const loadTable = vi.fn((table: string) => {
      if (table === 'first') return first.promise;
      if (table === 'second') return second.promise;
      return Promise.reject(new Error('broken table'));
    });

    const pending = loadSchemaTree(['first', 'second', 'broken'], loadTable);
    expect(loadTable).toHaveBeenCalledTimes(3);

    first.resolve([{ name: 'id', type: 'INTEGER', notnull: true, dflt_value: null, pk: true }]);
    second.resolve([{ name: 'name', type: 'VARCHAR', notnull: false, dflt_value: null, pk: false }]);

    await expect(pending).resolves.toEqual({
      tree: {
        first: [{ name: 'id', type: 'INTEGER', notnull: true, dflt_value: null, pk: true }],
        second: [{ name: 'name', type: 'VARCHAR', notnull: false, dflt_value: null, pk: false }],
      },
      errors: [{ table: 'broken', message: 'broken table' }],
    });
  });
});
