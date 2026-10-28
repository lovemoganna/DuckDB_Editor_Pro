// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DataIdeMissionControl } from './DataIdeMissionControl';
import type { Dashboard } from '../../../types';

const state = vi.hoisted(()=>({database:'review',noop:()=>{}}));
vi.mock('../../../hooks/store/useAppStore',()=>({useAppStore:(selector:any)=>selector({currentDatabase:state.database,setPendingChartConfig:state.noop,setPendingSql:state.noop})}));
vi.mock('../../../hooks/store/useSqlEditorStore',()=>({useSqlEditorStore:(selector:any)=>selector({createTab:state.noop})}));
vi.mock('../../../hooks/store/useCopilotStore',()=>({useCopilotStore:(selector:any)=>selector({setContext:state.noop})}));
vi.mock('../../../hooks/useAnalyticalCatalog',()=>({useAnalyticalCatalog:()=>({catalog:{tables:[]}})}));
vi.mock('../Home/SqlWorkspaceInput',()=>({SqlWorkspaceInput:()=>null}));
vi.mock('../Home',()=>({
  HomeHeader:()=>null,HomeInsightStrip:()=>null,HomeAssetRail:()=>null,HomeQueryInsight:()=>null,HomeDataFoundation:()=>null,
  HomeBoardCanvas:({brushFilter,onBrushFilterChange}:any)=><div><output>{brushFilter?.value||'无临时选择'}</output><button onClick={()=>onBrushFilterChange({column:'currency',value:'USD'})}>选择 USD</button></div>,
}));
afterEach(cleanup);
it('retains selection through same-view saves but clears it on view or database switches',()=>{
  const board={id:'one',items:[],name:'one',createdAt:0,updatedAt:0} as Dashboard;
  const props={metrics:{} as any,tables:[{name:'real',rowCount:1}] as any,queries:[],onNavigate:state.noop,onOpenImport:state.noop,onOpenCreate:state.noop,onOpenSettings:state.noop,onRefresh:state.noop};
  const {rerender}=render(<DataIdeMissionControl {...props} homeDashboard={board}/>);
  fireEvent.click(screen.getByText('选择 USD'));
  rerender(<DataIdeMissionControl {...props} homeDashboard={{...board,updatedAt:1}}/>);
  expect(screen.getByText('USD')).toBeTruthy();
  rerender(<DataIdeMissionControl {...props} homeDashboard={{...board,id:'two'}}/>);
  expect(screen.getByText('无临时选择')).toBeTruthy();
  fireEvent.click(screen.getByText('选择 USD'));
  state.database='other';
  rerender(<DataIdeMissionControl {...props} homeDashboard={{...board,id:'two'}}/>);
  expect(screen.getByText('无临时选择')).toBeTruthy();
});
