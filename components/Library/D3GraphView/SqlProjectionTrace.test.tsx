import React from 'react';
import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import {ProjectionTrace} from './SqlProjectionTrace';
import type {GraphNode, GraphLink} from './D3GraphView.types';
afterEach(cleanup);
const node:GraphNode={id:'record',label:'Actual user',group:'instance',color:'#888',size:12,description:'',_trace:{table:'real.main.users',key:{uid:'2'},properties:{name:'<img src=x onerror=alert(1)>'}},_rowIndices:[1]};
it('shows actual source keys and contributing rows inside the graph inspector without interpreting values as HTML',()=>{
  render(<ProjectionTrace node={node} rows={[{uid:1},{uid:2}]}/>);
  expect(screen.getByLabelText('SQL 对象来源')).toHaveTextContent('real.main.users');
  expect(screen.getByLabelText('SQL 对象来源')).toHaveTextContent('"uid": "2"');
  expect(document.querySelector('img')).toBeNull();expect(screen.getByText('原始查询记录 · 1 行')).toBeInTheDocument();
  expect(document.querySelector('pre')).toHaveTextContent('"uid": 2');expect(document.querySelector('pre')).not.toHaveTextContent('"uid": 1');
});
it('preserves relationship properties and every contributing row',()=>{
  const link:GraphLink={source:'a',target:'b',color:'#888',weight:1,_linkTypeName:'belongsTo',_properties:{unit:'USD'},_rowIndices:[0,1]};
  render(<ProjectionTrace link={link} rows={[{amount:3},{amount:4}]}/>);
  expect(screen.getByLabelText('SQL 关系来源')).toHaveTextContent('belongsTo');expect(screen.getByLabelText('SQL 关系来源')).toHaveTextContent('USD');
  expect(screen.getByText('原始查询记录 · 2 行')).toBeInTheDocument();
});
