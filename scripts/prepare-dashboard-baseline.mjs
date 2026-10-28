import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const target=path.resolve('data/crud-lab/baseline.duckdb');
const expected='a16db823884ef4c8a6056214c624eaf12fc12a454e31a93f2ab180b5948cc887';
let bytes;
try {bytes=await readFile(target);} catch(error) {
  if(error.code!=='ENOENT')throw error;
  const encoded=process.env.DASHBOARD_BASELINE_BASE64;
  if(!encoded)throw new Error('Real-data acceptance requires data/crud-lab/baseline.duckdb or the private DASHBOARD_BASELINE_BASE64 repository secret. No sample data will be substituted.');
  bytes=Buffer.from(encoded,'base64');
  if(createHash('sha256').update(bytes).digest('hex')!==expected)throw new Error('Private acceptance baseline hash mismatch');
  await mkdir(path.dirname(target),{recursive:true});
  await writeFile(target,bytes,{flag:'wx'});
}
if(createHash('sha256').update(bytes).digest('hex')!==expected)throw new Error('Acceptance baseline hash mismatch');
console.log('Verified private real-data baseline; no database content is printed or committed.');
