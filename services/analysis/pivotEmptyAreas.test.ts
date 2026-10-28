import {describe,expect,it} from 'vitest';
import {defaultPivot,pivotToSpec,PIVOT_ALL_ROWS_COLUMN,PIVOT_DEFAULT_METRIC} from './pivotExperience';
import {compileAnalysisSql} from './sqlCompiler';

const source={id:'query:orders',name:'Orders',catalog:'memory',schema:'main',kind:'query' as const,version:1,sql:'SELECT * FROM orders',fields:[{name:'region',type:'VARCHAR'},{name:'month',type:'VARCHAR'},{name:'amount',type:'DOUBLE'}]};

describe('pivot with empty 行 / 列 / 值', () => {
  it('compiles with no values by falling back to a record count', () => {
    const definition={...defaultPivot(source),metrics:[]};
    const spec=pivotToSpec(definition);
    expect(spec.metrics.map(metric=>metric.alias)).toEqual([PIVOT_DEFAULT_METRIC.alias]);
    expect(()=>compileAnalysisSql(spec)).not.toThrow();
  });
  it('collapses all records into one virtual row when 行 is empty',() => {
    const definition={...defaultPivot(source),row:undefined,rows:[],column:{column:'month'}};
    const spec=pivotToSpec(definition);
    expect(spec.dimensions[0].column).toBe(PIVOT_ALL_ROWS_COLUMN);
    expect(spec.dataset.sql).toContain('SELECT *');
    expect(spec.dataset.sql).toContain(source.sql);
    const {sql}=compileAnalysisSql(spec);
    expect(sql).toContain(PIVOT_ALL_ROWS_COLUMN);
  });
  it('allows 行, 列 and 值 to all be empty at once',() => {
    const definition={...defaultPivot(source),row:undefined,rows:[],column:undefined,metrics:[]};
    const spec=pivotToSpec(definition);
    expect(spec.dimensions).toHaveLength(1);
    expect(spec.metrics).toHaveLength(1);
    expect(()=>compileAnalysisSql(spec)).not.toThrow();
  });
  it('does not mutate the stored source when synthesising the virtual row',() => {
    const definition={...defaultPivot(source),row:undefined,rows:[],metrics:[]};
    pivotToSpec(definition);
    expect(definition.source.sql).toBe(source.sql);
    expect(definition.source.fields).toHaveLength(3);
  });
  it('still rejects a field that no longer exists',() => {
    const definition={...defaultPivot(source),row:undefined,rows:[],column:{column:'gone'}};
    expect(()=>pivotToSpec(definition)).toThrow(/已不存在/);
  });
});
