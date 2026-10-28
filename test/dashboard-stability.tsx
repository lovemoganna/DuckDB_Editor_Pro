/** Browser acceptance only. No business rows are invented or copied into the application. */
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { duckDBService } from '../services/duckdbService';
import { dbService } from '../services/dbService';
import { HomeBoardCanvas } from '../components/Dashboard/Home/HomeBoardCanvas';
import { useAppStore } from '../hooks/store/useAppStore';
import { getDashboardIncidents } from '../services/dashboardDiagnostics';
import type { Dashboard, SavedQuery } from '../types';
import type { BoardBrushFilter } from '../components/Dashboard/Home/homeBoardTypes';

const catalog='dashboard_acceptance';
const table=`${catalog}.main.fiat_transactions`;
async function setup():Promise<Dashboard> {
  const response=await fetch('../data/crud-lab/baseline.duckdb');
  if(!response.ok)throw new Error(`Baseline HTTP ${response.status}`);
  const bytes=await response.arrayBuffer();
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!=='a16db823884ef4c8a6056214c624eaf12fc12a454e31a93f2ab180b5948cc887')throw new Error('Baseline hash mismatch');
  await duckDBService.registerFileBuffer('dashboard-acceptance.duckdb',new Uint8Array(bytes));
  await duckDBService.query(`ATTACH 'dashboard-acceptance.duckdb' AS ${catalog} (READ_ONLY)`);
  await duckDBService.query(`USE ${catalog}`);
  useAppStore.setState({currentDatabase:catalog});
  const now=Date.now();
  const queries:SavedQuery[]=[
    {id:'acceptance-kpi',databaseName:catalog,name:'USD 完成金额',createdAt:now,sql:`SELECT SUM(amount) amount FROM ${table} WHERE currency='USD' AND status='completed'`,widgetType:'value',charts:[{id:'kpi',title:'USD 完成金额',type:'counter',xKey:'',yKeys:['amount'],unit:'USD'}]},
    {id:'acceptance-chart',databaseName:catalog,name:'渠道金额',createdAt:now,sql:`SELECT channel, SUM(amount) amount FROM ${table} WHERE currency='USD' AND status='completed' GROUP BY channel ORDER BY channel`,widgetType:'chart',charts:[{id:'channel',title:'渠道金额',type:'bar',xKey:'channel',yKeys:['amount'],unit:'USD',showLegend:true}]},
    {id:'acceptance-table',databaseName:catalog,name:'完成订单明细',createdAt:now,sql:`SELECT fiat_order_id,channel,amount FROM ${table} WHERE currency='USD' AND status='completed' ORDER BY fiat_order_id`,widgetType:'table'},
  ];
  for(const query of queries)await dbService.saveQuery(query);
  const existing=(await dbService.getDashboards(catalog)).find(board=>board.id==='acceptance-board');
  if(existing)return existing;
  const board:Dashboard={id:'acceptance-board',databaseName:catalog,name:'真实数据稳定性验收',createdAt:now,updatedAt:now,layoutLocked:true,formatVersion:2,context:{filters:[],refreshSeconds:30},items:[
    {i:'kpi',savedQueryId:queries[0].id,x:0,y:0,w:2,h:3},
    {i:'chart',savedQueryId:queries[1].id,x:2,y:0,w:10,h:6},
    {i:'table',savedQueryId:queries[2].id,x:0,y:6,w:12,h:7},
  ]};
  await dbService.saveDashboard(board);
  return board;
}
function Acceptance() {
  const [board,setBoard]=useState<Dashboard|null>(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[brush,setBrush]=useState<BoardBrushFilter|null>(null);
  useEffect(()=>{setup().then(setBoard).catch(error=>setError(String(error.message)));},[]);
  useEffect(()=>{
    // Read-only inspection helpers for the unattended acceptance runner.
    Object.assign(window,{dashboardAcceptance:{incidents:getDashboardIncidents, stored:()=>dbService.getDashboards(catalog)}});
  },[]);
  return <main className="min-h-screen bg-monokai-bg p-3 text-monokai-fg">
    <h1>真实数据看板稳定性验收</h1>
    {error&&<p role="alert">{error}</p>}
    {!board&&!error&&<p role="status">正在读取真实基线…</p>}
    <div className="my-3 flex flex-wrap gap-4">
      <button onClick={()=>setRefresh(n=>n+1)}>刷新验收</button>
      <button onClick={()=>setBrush({column:'channel',value:'wire_transfer',sourceWidgetId:'acceptance-control',bindings:{[`table:${JSON.stringify([catalog,'main','fiat_transactions'])}`]:'channel'}})}>筛选渠道</button>
      <button onClick={()=>setBrush(null)}>清除渠道</button>
    </div>
    {board&&<HomeBoardCanvas dashboard={board} refreshTrigger={refresh} brushFilter={brush} onBrushFilterChange={setBrush} onDashboardChange={setBoard} onNavigate={()=>{}}/>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Acceptance/>);
