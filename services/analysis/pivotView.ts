import type {ChartSpec} from './types';
export function comparePivotValues(a:unknown,b:unknown):number {
  if(a==null)return b==null?0:1;if(b==null)return -1;
  const parse=(value:unknown)=>{
    const match=String(value).match(/^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
    if(!match)return null;
    const exponent=Number(match[4] || 0);if(Math.abs(exponent)>1000)return null;
    const digits=match[2]+(match[3] || ''),point=match[2].length+exponent;
    const whole=(point<=0?'0':digits.padEnd(point,'0').slice(0,point)).replace(/^0+(?=\d)/,'');
    const fraction=(point<0?'0'.repeat(-point)+digits:digits.slice(point)).replace(/0+$/,'');
    return {negative:!!match[1] && (whole!=='0' || !!fraction),whole,fraction};
  };
  const x=parse(a),y=parse(b);
  if(!x || !y)return String(a).localeCompare(String(b),'zh-CN',{numeric:true});
  if(x.negative!==y.negative)return x.negative?-1:1;
  const size=Math.max(x.fraction.length,y.fraction.length);
  const value=x.whole.length-y.whole.length || x.whole.localeCompare(y.whole) || x.fraction.padEnd(size,'0').localeCompare(y.fraction.padEnd(size,'0'));
  return x.negative?-value:value;
}
export const csvText=(rows:unknown[][])=>'\uFEFF'+rows.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
export function downloadPivotCsv(rows:unknown[][],name:string):void {
  const url=URL.createObjectURL(new Blob([csvText(rows)],{type:'text/csv;charset=utf-8;'}));
  const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function pivotMatrixRows(pivot:NonNullable<ChartSpec['pivotTable']>,rows:string[]):unknown[][] {
  const columns=pivot.colValues;
  return [[pivot.rowKey,...columns.map(c=>pivot.colLabels?.[c]??c),'来源行汇总'],
    ...rows.map(r=>[pivot.rowLabels?.[r]??r,...columns.map(c=>pivot.matrix[r]?.[c]),pivot.rowTotals[r]]),
    [pivot.totalsScope==='source'?'总计（全部符合条件的来源）':'总计（当前查找数据）',...columns.map(c=>pivot.colTotals[c]),pivot.grandCount?pivot.grandTotal:null]];
}
