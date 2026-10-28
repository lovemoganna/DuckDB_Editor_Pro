import {expect,it} from 'vitest';
import {chartFillLabelColor} from './chartTheme';

it('keeps inside-bar labels above 4.5:1 on every default palette fill in both themes',()=>{
  const luminance=(hex:string)=>hex.slice(1).match(/../g)!.map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
  for(const background of ['#1e1f1c','#f5f7f2'])for(const fill of ['#f92672','#a6e22e','#66d9ef','#fd971f','#ae81ff','#e6db74','#ad1457']) {
    const label=chartFillLabelColor(fill,background);
    const values=[luminance(fill),luminance(label)].sort((a,b)=>b-a);
    expect((values[0]+.05)/(values[1]+.05)).toBeGreaterThanOrEqual(4.5);
  }
  expect(chartFillLabelColor('#ad1457','#f5f7f2')).toBe('#ffffff');
  expect(chartFillLabelColor('#a6e22e','#1e1f1c')).toBe('#000000');
});

it('accounts for translucent fills over the plot background',()=>{
  expect(chartFillLabelColor('rgba(0,0,0,0.1)','#ffffff')).toBe('#000000');
  expect(chartFillLabelColor('rgba(0,0,0,0.95)','#ffffff')).toBe('#ffffff');
});
