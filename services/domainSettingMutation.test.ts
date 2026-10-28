import {expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({value:[] as string[]}));
vi.mock('./dbService',()=>({dbService:{getDomainSetting:async()=>structuredClone(state.value),saveDomainSetting:async(_key:string,value:string[])=>{state.value=structuredClone(value);}}}));
import {mutateDomainSetting} from './domainSettingMutation';
it('serializes the whole read/modify/write and releases a failed writer',async()=>{
  state.value=[];
  await Promise.all(['A','B','C'].map(label=>mutateDomainSetting<string[]>('linked-analyses','memory',value=>[...(value || []),label])));
  expect(state.value).toEqual(['A','B','C']);
  await expect(mutateDomainSetting('linked-analyses','memory',()=>{throw new Error('conflict');})).rejects.toThrow('conflict');
  await mutateDomainSetting<string[]>('linked-analyses','memory',value=>[...(value || []),'D']);
  expect(state.value).toEqual(['A','B','C','D']);
});
