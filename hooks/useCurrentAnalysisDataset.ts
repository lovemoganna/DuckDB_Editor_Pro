import { useEffect, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { duckDBService } from '../services/duckdbService';
import { loadDatasets } from '../services/workbench/datasets';
import { useWorkbenchRevision } from '../services/workbench/runtime';
import type { DatasetDefinition } from '../services/workbench/analysisTypes';
import { requireAnalysisQuery } from '../services/analysis/readQueryGuard';
import {validateUniqueKeys} from '../services/workbench/datasetGuards';
import {compileAnalysis,analysisSqlForEditor} from '../services/workbench/queryCompiler';

/** Resolve the same selected source used by Home / Data / SQL, with current catalog ownership. */
export function useCurrentAnalysisDataset(reload=0,enabled=true) {
  const selected = useAppStore(s=>s.activeDataset);
  const table = useAppStore(s=>s.currentTable);
  const database = useAppStore(s=>s.currentDatabase);
  const revision = useWorkbenchRevision();
  const [resolved,setResolved] = useState<{request:string;source:string;dataset:DatasetDefinition|null;error:string}>();
  const source = JSON.stringify([selected,table,database]);
  const request = JSON.stringify([source,revision,reload,enabled]);
  useEffect(()=>{
    let current=true;
    if(!enabled){setResolved({request,source,dataset:null,error:''});return;}
    void (async()=>{
      try {
        const scope=await duckDBService.getCurrentCatalogAndSchema();
        let dataset=selected;
        if(dataset && (dataset.catalog!==scope.catalog || dataset.schema!==scope.schema)) throw new Error('数据集所属数据库或 Schema 已变化，请重新选择数据集');
        if(dataset?.origin==='home') {
          const datasets=await loadDatasets(scope.catalog);
          const selectedId=dataset.id;
          const definition=datasets.find(item=>item.id===selectedId);
          if(!definition)throw new Error('当前数据集已移除，请重新选择');
          if(definition.error)throw new Error(definition.error);
          const compiled=compileAnalysis({sql:'',catalog:definition.catalog,schema:definition.schema,datasets,globalFilters:dataset.appliedFilters,
            spec:{datasetId:definition.id,dimensions:[],aggregation:'DETAIL'}});
          dataset={...definition,origin:'home',appliedFilters:dataset.appliedFilters,sql:analysisSqlForEditor(compiled)};
        }
        if(!dataset && table) {
          const matches=(await loadDatasets(scope.catalog)).filter(d=>d.catalog===scope.catalog && d.schema===scope.schema && (d.table===table || d.name===table));
          if(matches.length!==1) throw new Error(`当前数据表 ${table} 不存在或来源不唯一`);
          dataset=matches[0];
        }
        if(dataset) {
          if(dataset.error) throw new Error(dataset.error);
          await validateUniqueKeys(dataset.uniqueKeys || []);
          const fields=await duckDBService.readQuery(`DESCRIBE ${requireAnalysisQuery(dataset.sql)}`);
          dataset={...dataset,fields:fields.map(f=>({name:String(f.column_name),type:String(f.column_type)}))};
        }
        if(current)setResolved({request,source,dataset,error:''});
      }catch(error){if(current)setResolved({request,source,dataset:null,error:String((error as Error).message)});}
    })();
    return()=>{current=false;};
  },[request]);
  return {dataset:resolved?.source===source?resolved.dataset:null,error:resolved?.request===request?resolved.error:'',
    pending:enabled && resolved?.request!==request,hasSource:!!(selected||table),request,source};
}
