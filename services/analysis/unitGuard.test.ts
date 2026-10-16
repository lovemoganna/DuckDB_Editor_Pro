import { describe,it,expect } from 'vitest';
import { createEmptySpec,emptyFilters } from './types';
import { validateMeasurementUnits } from './unitGuard';
describe('financial measurement boundaries',()=>{
  const spec=()=>createEmptySpec({id:'mixed',dataset:{table:'crypto_transactions'},fields:[{column:'amount'},{column:'asset'}],dimensions:[],metrics:[{id:'m',column:'amount',agg:'sum',alias:'amount'}],filters:emptyFilters(),visual:{chartType:'bar'}});
  it('rejects cross-asset amount and fee aggregates',()=>{
    expect(()=>validateMeasurementUnits(spec())).toThrow('不能直接合计');
  });
  it('accepts separate-asset grouping and one explicit asset',()=>{
    const grouped=spec();grouped.dimensions=[{id:'a',column:'asset'}];expect(()=>validateMeasurementUnits(grouped)).not.toThrow();
    const filtered=spec();filtered.filters.global=[{column:'asset',op:'=',value:'BTC'}];expect(()=>validateMeasurementUnits(filtered)).not.toThrow();
    filtered.filters.global=[{column:'asset',op:'in',value:['BTC','ETH']}];expect(()=>validateMeasurementUnits(filtered)).toThrow();
  });
  it('does not treat transaction counts as currency amounts',()=>{
    const counted=spec();counted.metrics=[{id:'m',agg:'count',alias:'orders'}];expect(()=>validateMeasurementUnits(counted)).not.toThrow();
  });
  it('requires one unit for windows and ratios even with grouped assets',()=>{
    const window=spec();window.dimensions=[{id:'a',column:'asset'}];window.calcs=[{id:'c',kind:'cumulative',sourceMetricId:'m',alias:'cum'}];expect(()=>validateMeasurementUnits(window)).toThrow('窗口');
  });
});
