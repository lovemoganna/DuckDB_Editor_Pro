import { describe,it,expect } from 'vitest';
import { compileAnalysis,relationReferences,validateFilters,analysisSqlForEditor } from './queryCompiler';
it('does not treat null-safe pivot join comparisons as source relations',()=>{
  const sql='SELECT a.region FROM orders a LEFT JOIN orders pr ON a.region IS NOT DISTINCT FROM pr.region';
  expect(relationReferences(sql).map(ref=>ref.parts)).toEqual([['orders'],['orders']]);
});
import type { DatasetDefinition,AnalysisFilter } from './analysisTypes';
const orders:DatasetDefinition={id:'orders',name:'orders',catalog:'sales',schema:'main',table:'orders',sql:'SELECT * FROM "sales"."main"."orders"',fields:[{name:'amount',type:'DECIMAL'},{name:'region',type:'VARCHAR'},{name:'created_at',type:'TIMESTAMP'}],version:1,kind:'table'};
const filter:AnalysisFilter={id:'r',field:'region',operator:'eq',value:"x' OR TRUE --",bindings:{orders:'region'}};
describe('analysis query contract',()=>{
  it('binds every selected scatter record as a parameter, including quote characters',()=>{
    const selection:AnalysisFilter={...filter,operator:'in',value:'2 项',values:['A', "x' OR TRUE --"]};
    const result=compileAnalysis({sql:'SELECT * FROM orders',catalog:'sales',schema:'main',datasets:[orders],globalFilters:[selection]});
    expect(result.params).toEqual(selection.values);
    expect(result.sql).not.toContain("x' OR TRUE");
    expect(result.sql).toContain(' OR ');
  });
  it('rejects missing unqualified sources rather than reading a namesake in the active catalog',()=>{
    const namesake={...orders,catalog:'other',id:'other-orders'};
    expect(()=>compileAnalysis({sql:'SELECT COUNT(*) FROM orders',catalog:'sales',schema:'main',datasets:[namesake]})).toThrow('数据来源 orders 不可访问');
    const cte=compileAnalysis({sql:'WITH counts(total) AS MATERIALIZED (SELECT COUNT(*) FROM sales.main.orders) SELECT * FROM counts',catalog:'sales',schema:'main',datasets:[orders]});
    expect(cte.sql).toContain('FROM counts');expect(cte.datasetIds).toEqual(['orders']);
    expect(()=>compileAnalysis({sql:'WITH x AS (SELECT 1) SELECT * FROM missing',catalog:'sales',schema:'main',datasets:[orders]})).toThrow('missing');
  });
  it('creates an executable SQL review copy without modifying bound execution',()=>{
    const compiled=compileAnalysis({sql:'SELECT * FROM orders',catalog:'sales',schema:'main',datasets:[orders],globalFilters:[filter]});
    expect(analysisSqlForEditor(compiled)).toContain("'x'' OR TRUE --'");expect(compiled.sql).toContain('= ?');expect(compiled.params).toEqual([filter.value]);
  });
  it('compiles stable detail ordering and typed time aggregation',()=>{
    const input={sql:'',catalog:'sales',schema:'main',datasets:[orders]};
    expect(compileAnalysis({...input,spec:{datasetId:'orders',dimensions:[],aggregation:'DETAIL'}}).sql).toContain('SELECT * FROM');
    expect(compileAnalysis({...input,spec:{datasetId:'orders',dimensions:[],aggregation:'DETAIL'}}).sql).toContain('ORDER BY ALL');
    expect(compileAnalysis({...input,spec:{datasetId:'orders',dimensions:['created_at'],aggregation:'COUNT',timeGrain:'month'}}).sql).toContain("date_trunc('month', \"created_at\") AS \"created_at\"");
    expect(()=>compileAnalysis({...input,spec:{datasetId:'orders',dimensions:['region'],aggregation:'COUNT',timeGrain:'month'}})).toThrow('时间粒度');
  });
  it('preserves exact numeric inputs and validates explicit bindings before persistence',()=>{
    const f={...filter,value:'9007199254740993',bindings:{orders:'amount'}};
    const output=compileAnalysis({sql:'SELECT * FROM orders',catalog:'sales',schema:'main',datasets:[orders],globalFilters:[f]});
    expect(output.params).toEqual(['9007199254740993']);expect(output.sql).toContain('CAST(? AS DECIMAL)');
    expect(()=>validateFilters([{...f,value:'x'}],[orders])).toThrow('有效数字');
    expect(()=>validateFilters([{...f,bindings:{gone:'amount'}}],[orders])).toThrow('不可访问');
    expect(()=>compileAnalysis({sql:'SELECT * FROM orders a, orders b',catalog:'sales',schema:'main',datasets:[orders],globalFilters:[filter]})).toThrow('逗号关联');
  });
  it('binds predicates before the aggregate without interpolating values',()=>{
    const result=compileAnalysis({sql:'SELECT SUM(amount) AS total FROM orders WHERE amount > 0',catalog:'sales',schema:'main',datasets:[orders],globalFilters:[filter]});
    expect(result.sql).toContain('FROM (SELECT * FROM "sales"."main"."orders" WHERE "region" = ?) AS "orders"');
    expect(result.sql).not.toContain(filter.value);expect(result.params).toEqual([filter.value]);
  });
  it('keeps trailing comments from consuming the outer dataset query',()=>{
    const result=compileAnalysis({sql:'',catalog:'sales',schema:'main',datasets:[{...orders,sql:orders.sql+' -- source note'}],spec:{datasetId:'orders',aggregation:'COUNT',dimensions:[]}});
    expect(result.sql).toContain('-- source note\n) AS dataset');
  });
  it('preserves aliases, literal strings, comments and parameter order across joined sources',()=>{
    const other={...orders,id:'other',catalog:'customers',table:'customers'};
    const result=compileAnalysis({sql:"SELECT 'FROM orders' AS text, SUM(o.amount) FROM orders AS o JOIN customers.main.customers c ON c.region=o.region -- FROM fake",catalog:'sales',schema:'main',datasets:[orders,other],globalFilters:[{...filter,value:'A',bindings:{orders:'region',other:'region'}}]});
    expect(result.params).toEqual(['A','A']);expect(result.sql).toContain('AS o JOIN (SELECT * FROM "customers"."main"."customers"');expect(result.sql).toContain("'FROM orders'");
  });
  it('reports inapplicable global filters and rejects unbound local filters',()=>{
    const unmatched={...filter,bindings:{elsewhere:'region'}};
    expect(compileAnalysis({sql:'SELECT SUM(amount) FROM orders',catalog:'sales',schema:'main',datasets:[orders],globalFilters:[unmatched]}).notices).toHaveLength(1);
    expect(()=>compileAnalysis({sql:'SELECT SUM(amount) FROM orders',catalog:'sales',schema:'main',datasets:[orders],localFilters:[unmatched]})).toThrow('局部筛选');
  });
  it('rejects stale fields, invalid numeric/date values and mutations',()=>{
    const compile=(f:AnalysisFilter)=>compileAnalysis({sql:'SELECT * FROM orders',catalog:'sales',schema:'main',datasets:[orders],globalFilters:[f]});
    expect(()=>compile({...filter,bindings:{orders:'missing'}})).toThrow('不属于');
    expect(()=>compile({...filter,value:'oops',bindings:{orders:'amount'}})).toThrow('有效数字');
    expect(()=>compile({...filter,value:'oops',bindings:{orders:'created_at'}})).toThrow('有效日期');
    expect(()=>compileAnalysis({sql:'DELETE FROM orders',catalog:'sales',schema:'main',datasets:[orders]})).toThrow('只读');
  });
  it('compiles a structured dataset with global and independent local filters',()=>{
    const result=compileAnalysis({sql:'',catalog:'sales',schema:'main',datasets:[orders],spec:{datasetId:'orders',aggregation:'SUM',measure:'amount',dimensions:['region']},globalFilters:[{...filter,value:'A'}],localFilters:[{id:'min',field:'amount',operator:'gte',value:'100',bindings:{orders:'amount'}}]});
    expect(result.sql).toContain('WHERE "region" = ? AND "amount" >= CAST(? AS DECIMAL) GROUP BY "region"');expect(result.params).toEqual(['A','100']);
  });
  it('does not guess CTE shadowing or inaccessible qualified catalogs',()=>{
    expect(()=>compileAnalysis({sql:'WITH orders AS (SELECT 1 AS amount) SELECT * FROM orders',catalog:'sales',schema:'main',datasets:[orders],globalFilters:[filter]})).toThrow('CTE');
    expect(()=>compileAnalysis({sql:'SELECT * FROM missing.main.orders',catalog:'sales',schema:'main',datasets:[orders]})).toThrow('不可访问');
    expect(relationReferences("SELECT 'FROM secret' FROM orders /* JOIN secret */")).toHaveLength(1);
  });
});

it('preserves lateral table functions while filtering their upstream relation',()=>{
  const sql=`WITH bounds AS (SELECT MIN(created_at) AS first_day,MAX(created_at) AS last_day FROM orders) SELECT day FROM bounds,LATERAL generate_series(first_day,last_day,INTERVAL '1 day') AS d(day)`;
  const result=compileAnalysis({sql,catalog:'sales',schema:'main',datasets:[orders],globalFilters:[filter]});
  expect(result.sql).toContain('bounds,LATERAL generate_series');
  expect(result.sql).toContain('WHERE "region" = ?');
  expect(result.params).toEqual([filter.value]);
  expect(()=>compileAnalysis({sql:'SELECT * FROM orders,LATERAL orders',catalog:'sales',schema:'main',datasets:[orders],globalFilters:[filter]})).toThrow('逗号关联');
});
