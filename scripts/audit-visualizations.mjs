import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';

// Reproducible source inventory; it reports references, not visual PASS verdicts.
const root=process.cwd();
const files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.(tsx?|jsx?)$/.test(file)&&!/\.test\./.test(file))files.push(file);}}
for(const dir of ['components','services','utils','hooks','src','types'])if(fs.existsSync(path.join(root,dir)))walk(path.join(root,dir));
for(const name of ['App.tsx','index.tsx','types.ts'])files.push(path.join(root,name));
const inventory=[],dependencies=[];
for(const file of files){
  const source=fs.readFileSync(file,'utf8');
  const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const imports=[],tags=new Set(),constructors=[],iconTags=new Set();
  function visit(node){
    if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier))imports.push({source:node.moduleSpecifier.text,bindings:node.importClause?.getText(tree)||'',line:tree.getLineAndCharacterOfPosition(node.getStart(tree)).line+1});
    if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)&&/lucide|heroicons/.test(node.moduleSpecifier.text)&&node.importClause?.namedBindings&&ts.isNamedImports(node.importClause.namedBindings))for(const element of node.importClause.namedBindings.elements)iconTags.add(element.name.text);
    if(ts.isExportDeclaration(node)&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))imports.push({source:node.moduleSpecifier.text,bindings:node.exportClause?.getText(tree)||'*',line:tree.getLineAndCharacterOfPosition(node.getStart(tree)).line+1});
    if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&node.arguments.length===1&&ts.isStringLiteral(node.arguments[0]))imports.push({source:node.arguments[0].text,bindings:'dynamic import',line:tree.getLineAndCharacterOfPosition(node.getStart(tree)).line+1});
    if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node))tags.add(node.tagName.getText(tree));
    if(ts.isNewExpression(node)&&/Chart/.test(node.expression.getText(tree)))constructors.push(node.expression.getText(tree));
    ts.forEachChild(node,visit);
  }
  visit(tree);
  dependencies.push({file:path.relative(root,file).replaceAll('\\','/'),imports:imports.map(item=>{
    const candidate=item.source.startsWith('@/')?path.resolve(root,item.source.slice(2)):path.resolve(path.dirname(file),item.source);
    const target=item.source.startsWith('.')||item.source.startsWith('@/')?[candidate,...['.ts','.tsx','.js','.jsx'].map(ext=>candidate+ext),path.join(candidate,'index.ts'),path.join(candidate,'index.tsx')].find(file=>fs.existsSync(file)&&fs.statSync(file).isFile()):undefined;
    return {...item,target:target?path.relative(root,target).replaceAll('\\','/'):null};
  })});
  const contract=imports.filter(item=>/ChartRenderer|chartRegistry|chartJsAdapter|chartDisplay|chartFormat|chartPlugins|chartUtils|ChartSpec/.test(item.source+' '+item.bindings));
  const libraries=imports.filter(item=>/^(react-chartjs-2|chart.js(?:\/.*)?|d3(?:-.*)?|reactflow|@xyflow\/react|mermaid|pixi.*|recharts|dagre|elkjs(?:\/.*)?)$/.test(item.source));
  const native=[...tags].filter(tag=>tag==='svg'||tag==='canvas');
  const renderTags=[...tags].filter(tag=>!iconTags.has(tag)&&/Chart|Graph|Canvas|Pivot|Gauge|Spark|Trend|Flow|Diagram/.test(tag));
  const direct=imports.filter(item=>item.source==='react-chartjs-2');
  if(contract.length||libraries.length||native.length||constructors.length||renderTags.length)inventory.push({file:path.relative(root,file).replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(source).digest('hex'),
    contract,libraries,native,tags:renderTags,constructors,directCanvasConsumer:direct.length>0});
}
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const versions={};
for(const name of ['chart.js','react-chartjs-2','chartjs-plugin-datalabels','d3','reactflow','mermaid','pixi.js','recharts','dagre','elkjs','@duckdb/duckdb-wasm']){
  const file=path.join(root,'node_modules',name,'package.json');
  versions[name]={declared:pkg.dependencies?.[name]||null,installed:fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')).version:null};
}
const report={generatedAt:new Date().toISOString(),scannedFiles:files.length,versions,inventory,dependencies,
  directCanvasConsumers:inventory.filter(item=>item.directCanvasConsumer).map(item=>item.file),
  note:'Source references only. Native SVG includes branding/decorative graphics; graph contracts retain topology semantics. No runtime or capability verdict is inferred.'};
const output=process.argv[2]||'docs/visualization-governance-20261008/inventory.json';
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
const rows=inventory.map(item=>`| ${item.file} | ${item.libraries.map(lib=>lib.source).join(', ')||'-'} | ${item.tags.join(', ')||item.native.join(', ')||'shared dependency'} |`);
fs.writeFileSync(output.replace(/\.json$/,'.md'),'# Visualization Source Inventory\n\nSource references only; no runtime PASS is implied. See matching JSON for hashes and dependency edges.\n\n| File | Libraries | Render references |\n| --- | --- | --- |\n'+rows.join('\n')+'\n');
console.log(JSON.stringify({scannedFiles:files.length,entries:inventory.length,directCanvasConsumers:report.directCanvasConsumers,versions}));
