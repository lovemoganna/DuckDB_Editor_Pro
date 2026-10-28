// Independent engine validation. Requires the installed Python duckdb package.
// All fixture data lives in isolated in-memory catalogs, never the user database.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),{spawnSync}=require('node:child_process');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {compileAnalysis}=require('../services/workbench/queryCompiler.ts');
const source={id:'orders',name:'sales orders',catalog:'sales',schema:'main',table:'orders',sql:'SELECT * FROM sales.main.orders',fields:[{name:'id',type:'INTEGER'},{name:'amount',type:'DECIMAL(18,2)'},{name:'region',type:'VARCHAR'},{name:'currency',type:'VARCHAR'},{name:'created_at',type:'TIMESTAMP'}],kind:'table',version:1};
const customer={...source,id:'customers',catalog:'people',table:'customers',sql:'SELECT * FROM people.main.customers',fields:[{name:'id',type:'INTEGER'},{name:'region',type:'VARCHAR'}]};
const region={id:'region',field:'region',operator:'eq',value:'A',bindings:{orders:'region'}};
const range={id:'date',field:'created_at',operator:'gte',value:'2025-02-01',bindings:{orders:'created_at'}};
const input={sql:'',catalog:'sales',schema:'main',datasets:[source,customer]};
const cases=[
 {name:'complete aggregate exceeds preview cap',...compileAnalysis({...input,spec:{datasetId:'orders',aggregation:'SUM',measure:'amount',dimensions:['currency']},globalFilters:[region,range]}),expected:[['USD','1500.00']]},
 {name:'independent instance local filter',...compileAnalysis({...input,spec:{datasetId:'orders',aggregation:'COUNT',dimensions:[]},globalFilters:[range],localFilters:[{...region,value:'B'}]}),expected:[[500]]},
 {name:'SQL filters before aggregation',...compileAnalysis({...input,sql:'SELECT SUM(amount) AS value FROM orders',globalFilters:[region,range]}),expected:[['1500.00']]},
 {name:'cross catalog unique JOIN',...compileAnalysis({...input,sql:'SELECT COUNT(*) FROM sales.main.orders o JOIN people.main.customers c ON o.id=c.id',globalFilters:[region]}),expected:[[1500]]},
 {name:'monthly grouping',...compileAnalysis({...input,spec:{datasetId:'orders',aggregation:'COUNT',dimensions:['created_at'],timeGrain:'month'},globalFilters:[region]}),expected:[['2025-02-01',1500]]},
 {name:'NULL and empty result',...compileAnalysis({...input,spec:{datasetId:'orders',aggregation:'COUNT',dimensions:[]},globalFilters:[{...region,operator:'isNull'}]}),expected:[[0]]},
 {name:'bound hostile text',...compileAnalysis({...input,spec:{datasetId:'orders',aggregation:'COUNT',dimensions:[]},globalFilters:[{...region,value:"A' OR TRUE --"}]}),expected:[[0]]},
 {name:'detail pagination',...compileAnalysis({...input,spec:{datasetId:'orders',aggregation:'DETAIL',dimensions:[]},globalFilters:[region]}),page:true,expectedCount:1500},
 {name:'dataset trailing comment',...compileAnalysis({...input,datasets:[{...source,sql:source.sql+' -- source note'}],spec:{datasetId:'orders',aggregation:'COUNT',dimensions:[]}}),expected:[[2000]]},
];
const script=String.raw`
import duckdb,json,sys,datetime,decimal
cases=json.loads(sys.stdin.read())
c=duckdb.connect()
c.execute("ATTACH ':memory:' AS sales")
c.execute("ATTACH ':memory:' AS people")
c.execute("CREATE TABLE sales.main.orders AS SELECT i::INTEGER AS id, 1.00::DECIMAL(18,2) AS amount, CASE WHEN i<=1500 THEN 'A' ELSE 'B' END AS region, 'USD' AS currency, TIMESTAMP '2025-02-15 12:00:00' AS created_at FROM range(1,2001) t(i)")
c.execute("CREATE TABLE people.main.customers AS SELECT i::INTEGER AS id, 'A' AS region FROM range(1,2001) t(i)")
def clean(v):
 if isinstance(v,datetime.datetime): return v.date().isoformat()
 if isinstance(v,datetime.date): return v.isoformat()
 if isinstance(v,decimal.Decimal): return str(v)
 return v
for case in cases:
 if case.get('page'):
  count=c.execute('SELECT COUNT(*) FROM ('+case['sql']+')',case['params']).fetchone()[0]
  rows=c.execute('SELECT * FROM ('+case['sql']+') LIMIT 100 OFFSET 100',case['params']).fetchall()
  assert count==case['expectedCount'] and len(rows)==100 and rows[0][0]==101
 else:
  result=[[clean(v) for v in row] for row in c.execute(case['sql'],case['params']).fetchall()]
  assert result==case['expected'],(case['name'],result,case['expected'])
 print('PASS '+case['name'])
c.execute('UPDATE sales.main.orders SET amount=2 WHERE id=1')
case=cases[0]
assert str(c.execute(case['sql'],case['params']).fetchone()[1])=='1501.00'
print('PASS source mutation recomputes aggregate')
`;
const result=spawnSync('python',['-c',script],{input:JSON.stringify(cases),encoding:'utf8'});
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');if(result.error)console.error(result.error);process.exit(result.status??1);
