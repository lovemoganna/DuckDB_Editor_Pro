import {expect,it} from 'vitest';
import {tableSpace} from './tableSpace';
it('allocates by cell content and accounts for wrapped rows',()=>{
 const rows=[{unit:'USD',cause:'需要核对的完整业务规则说明'.repeat(10),amount:123456789.12}];
 const size=tableSpace(['unit','cause','amount'],rows);
 expect(size.widths[0]).toBeLessThan(size.widths[1]);
 expect(size.rowHeight).toBeGreaterThan(32);
 expect(rows[0].cause).toHaveLength(130);
});
