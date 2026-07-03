const c={select(i,l){var e,r;const{conditions:n,orderBy:t,limit:a}=i;let o=`SELECT * FROM "${l.tableName||"table_name"}"`;if(n&&(o+=` WHERE ${n}`),t&&t!=="不排序"){const s=t==="升序"?"ASC":"DESC";o+=` ORDER BY ${((r=(e=l.columns)==null?void 0:e[0])==null?void 0:r.name)||"id"} ${s}`}return o+=` LIMIT ${a||100};`,o},join(i,l){const{joinType:n,rightTable:t,joinCondition:a,selectColumns:o}=i,e=l.tableName||"left_table";return`SELECT ${o||"a.*, b.*"}
FROM "${e}" a
${n} "${t}" b ON ${a};`},aggregation(i,l){const{aggregationType:n,groupBy:t,having:a}=i,o=l.tableName||"table_name";let e="SELECT ";if(n==="多聚合")e+="COUNT(*), SUM(col), AVG(col), MIN(col), MAX(col)";else{const r=n==="COUNT"?"COUNT(*)":`${n}(col)`;e+=r}return e+=` FROM "${o}"`,t&&(e+=` GROUP BY ${t}`),a&&(e+=` HAVING ${a}`),e+=";",e},window(i,l){const{windowFunction:n,partitionBy:t,orderBy:a,frame:o}=i,e=l.tableName||"table_name";let r=`SELECT *,
  ${n}() OVER (`;return t&&(r+=`PARTITION BY ${t}`),a&&(r+=(t?" ":"")+`ORDER BY ${a}`),o&&o!=="无"&&(r+=` ${o}`),r+=`) AS result
FROM "${e}";`,r},cte(i,l){const{cteName:n,cteQuery:t,mainQuery:a}=i;return`WITH ${n} AS (
  ${t}
)
${a};`},insert(i,l){var s;const{values:n,mode:t,conflictAction:a}=i,o=l.tableName||"table_name",e=((s=l.columns)==null?void 0:s.map(N=>N.name).join(", "))||"col1, col2";let r=`INSERT INTO "${o}" (${e})`;return t==="INSERT ... RETURNING"?r+=` VALUES (${n}) RETURNING *;`:t==="INSERT ... ON CONFLICT"?r+=` VALUES (${n}) ON CONFLICT DO ${a||"NOTHING"};`:r+=` VALUES (${n});`,r},update(i,l){const{setClause:n,whereCondition:t,returning:a}=i;let e=`UPDATE "${l.tableName||"table_name"}"
SET ${n}
WHERE ${t}`;return a&&(e+=" RETURNING *"),e+=";",e},delete(i,l){const{whereCondition:n,limit:t,returning:a}=i;let e=`DELETE FROM "${l.tableName||"table_name"}"
WHERE ${n}`;return t&&(e+=` LIMIT ${t}`),a&&(e+=" RETURNING *"),e+=";",e}};export{c as sqlQueryGenerators};
