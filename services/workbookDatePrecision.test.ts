import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import writeXlsxFile from 'write-excel-file/browser';
import {workbookIO} from './workbookIO';

it('preserves the real four-table workbook timestamps to the millisecond',async()=>{
  const bytes=readFileSync('test/fixtures/exchange-funds-four-tables.xlsx');
  const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;
  const sheets=await workbookIO.readAllSheets({name:'funds.xlsx',size:bytes.length,arrayBuffer:async()=>buffer});
  expect(sheets.map(s=>[s.name,s.rowCount])).toEqual([['users',10],['fiat_transactions',25],['crypto_transactions',25],['exchange_rates',8]]);
  expect(sheets[0].rows[0][6]).toBe('2024-01-15 08:30:00.000');
  expect(sheets[0].rows[3][6]).toBe('2024-04-12 11:20:00.000');
});

it('retains genuine subsecond timestamps rather than rounding to a second',async()=>{
  const dates=['2024-01-15T08:30:00.123Z','2024-01-15T08:30:00.999Z','2025-01-01T00:00:00.001Z'];
  const output=writeXlsxFile([{sheet:'Dates',data:[[{value:'time',type:String}],...dates.map(d=>[{value:new Date(d),type:Date,format:'yyyy-mm-dd hh:mm:ss'}])]}]);
  const buffer=await (await output.toBlob()).arrayBuffer();
  const [sheet]=await workbookIO.readAllSheets({name:'dates.xlsx',size:buffer.byteLength,arrayBuffer:async()=>buffer});
  expect(sheet.rows.map(r=>r[0])).toEqual(dates.map(d=>d.replace('T',' ').replace('Z','')));
});

