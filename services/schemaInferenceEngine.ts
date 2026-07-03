/**
 * Schema Inference Engine
 *
 * Transforms DuckDB table schemas into ontology structures.
 * Key design goal: ALL output text must be understandable by non-technical users.
 */

export interface TableColumn {
  name: string;
  type: string;
  pk?: boolean;
  notnull?: boolean;
}

export interface TableInfo {
  name: string;
  columns: TableColumn[];
}

export interface InferredObjectType {
  id: string;
  tableName: string;
  name: string;
  description: string;
  confidence: number;
  reason: string;
}

export interface InferredLinkType {
  id: string;
  name: string;
  description: string;
  fromObjectTypeId: string;
  toObjectTypeId: string;
  confidence: number;
  reason: string;
}

export interface InferredOntology {
  objectTypes: InferredObjectType[];
  linkTypes: InferredLinkType[];
}

// ── Utilities ──────────────────────────────────────────────────

function singularize(word: string): string {
  if (!word) return word;
  const lower = word.toLowerCase();
  if (lower.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (lower.endsWith('es') && (
    lower.endsWith('shes') || lower.endsWith('ches') ||
    lower.endsWith('xes') || lower.endsWith('zes') ||
    lower.endsWith('ses') || lower.endsWith('les')
  )) {
    return word.slice(0, -2);
  }
  if (lower.endsWith('s') && !lower.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function isJunctionTable(table: TableInfo): boolean {
  const name = table.name.toLowerCase();
  const colNames = table.columns.map(c => c.name.toLowerCase());
  const hasRelKeywords = /_rel|_link|_junction|_map|_assoc/i.test(name);
  const hasTwoFkCols = colNames.filter(c => c.endsWith('_id')).length >= 2;
  return hasRelKeywords || hasTwoFkCols;
}

// ── Human-readable name inference ────────────────────────────────

function inferObjectTypeName(table: TableInfo): { name: string; explanation: string } {
  const name = table.name.toLowerCase();

  // Common English patterns → Chinese naming
  if (/^(users?|accounts?|customers?|profiles?)$/.test(name)) {
    return { name: '用户', explanation: '系统中注册或登录的人' };
  }
  if (/^(products?|items?|goods?)$/.test(name)) {
    return { name: '商品', explanation: '可供购买或使用的物品' };
  }
  if (/^(orders?|purchases?|transactions?)$/.test(name)) {
    return { name: '订单', explanation: '一次购买或交易记录' };
  }
  if (/^(categories?|tags?|labels?)$/.test(name)) {
    return { name: '分类', explanation: '用来组织或归类其他数据的标签' };
  }
  if (/^(posts?|articles?|blogs?|contents?)$/.test(name)) {
    return { name: '内容', explanation: '发布的信息或文章' };
  }
  if (/^(comments?|replies?)$/.test(name)) {
    return { name: '评论', explanation: '用户对内容的反馈或回复' };
  }
  if (/^(payments?|invoices?|bills?)$/.test(name)) {
    return { name: '账单', explanation: '付款或收款记录' };
  }
  if (/^(files?|documents?)$/.test(name)) {
    return { name: '文件', explanation: '上传或存储的文档' };
  }
  if (/^(logs?|audit_logs?|history|events?)$/.test(name)) {
    return { name: '记录', explanation: '系统操作或事件的日志' };
  }
  if (/^(settings?|configs?|preferences?)$/.test(name)) {
    return { name: '配置', explanation: '系统或用户的偏好设置' };
  }
  if (/^(images?|photos?|avatars?)$/.test(name)) {
    return { name: '媒体', explanation: '图片、照片等视觉资源' };
  }
  if (/^(notifications?|alerts?|messages?)$/.test(name)) {
    return { name: '通知', explanation: '发送给用户的提醒消息' };
  }
  if (/^(permissions?|roles?)$/.test(name)) {
    return { name: '权限', explanation: '用户可执行的操作范围' };
  }
  if (/^(reviews?|ratings?)$/.test(name)) {
    return { name: '评价', explanation: '用户对商品或服务的评分' };
  }
  if (/^(carts?|shopping_baskets?)$/.test(name)) {
    return { name: '购物车', explanation: '用户准备购买的物品清单' };
  }
  if (/^(stocks?|inventories?)$/.test(name)) {
    return { name: '库存', explanation: '商品的可售数量' };
  }
  if (/^(shipping?|delivery?)$/.test(name)) {
    return { name: '物流', explanation: '商品配送信息' };
  }
  if (/^(analytics?|statistics?|metrics?)$/.test(name)) {
    return { name: '统计', explanation: '数据汇总和分析' };
  }
  if (/^(projects?|tasks?|milestones?)$/.test(name)) {
    return { name: '项目', explanation: '工作或任务的管理单元' };
  }
  if (/^(employees?|staff?|teams?)$/.test(name)) {
    return { name: '员工', explanation: '组织中的成员' };
  }
  if (/^(departments?|branches?)$/.test(name)) {
    return { name: '部门', explanation: '组织中的分支或团队' };
  }
  if (/^(todos?|checklists?|tasks?)$/.test(name)) {
    return { name: '待办', explanation: '需要完成的任务清单' };
  }
  if (/^(schedules?|calendars?|events?)$/.test(name)) {
    return { name: '日程', explanation: '时间安排或日历事件' };
  }

  // Fallback: singularize
  const singular = singularize(table.name).replace(/[_\-]/g, ' ');
  return { name: singular, explanation: `来自「${table.name}」表的记录` };
}

// ── Core inference ─────────────────────────────────────────────

export function inferObjectTypes(tables: TableInfo[]): InferredObjectType[] {
  return tables.map(table => {
    const isJunction = isJunctionTable(table);
    const { name, explanation } = inferObjectTypeName(table);

    const enumCols = table.columns
      .filter(c => /\b(type|status|category|state|priority)$/i.test(c.name))
      .map(c => c.name.replace(/_/g, ' '));
    const hasEnum = enumCols.length > 0;
    const hasPK = table.columns.some(c => c.pk);
    const isLog = /log|audit|history/i.test(table.name);

    let description: string;
    let confidence: number;
    let reason: string;

    if (isJunction) {
      description = `用于把两个实体连接起来的中间表`;
      confidence = 0.75;
      reason = `这张表连接了两个其他表（属于「关系表」）`;
    } else if (hasEnum) {
      description = `${explanation}，可按「${enumCols.join('、')}」分类`;
      confidence = 0.95;
      reason = `包含「${enumCols.join('、')}」等分类字段，结构清晰`;
    } else if (hasPK) {
      description = explanation;
      confidence = 0.95;
      reason = `有主键列 '${table.columns.find(c => c.pk)?.name}'，是标准的实体表`;
    } else if (isLog) {
      description = '记录系统事件或操作历史的日志';
      confidence = 0.8;
      reason = `表名含有「log」或「audit」，属于日志表`;
    } else {
      description = explanation;
      confidence = 0.85;
      reason = `从表名「${table.name}」推断`;
    }

    return { id: `ot::${table.name}`, tableName: table.name, name, description, confidence, reason };
  });
}

export function inferLinkTypes(
  tables: TableInfo[],
  objectTypes: InferredObjectType[]
): InferredLinkType[] {
  const linkTypes: InferredLinkType[] = [];
  const seen = new Set<string>();

  const getOtId = (t: string) => `ot::${t}`;
  const getOt = (t: string) => objectTypes.find(o => o.tableName === t);
  const getOtName = (t: string) => getOt(t)?.name ?? singularize(t).replace(/[_\-]/g, ' ');

  for (const table of tables) {
    for (const col of table.columns) {
      const colName = col.name.toLowerCase();
      if (!colName.endsWith('_id') && !colName.endsWith('_ref')) continue;

      const refBase = col.name.replace(/_id$/i, '').replace(/_ref$/i, '').toLowerCase();

      let target = tables.find(t => t.name.toLowerCase() === refBase);
      if (!target && refBase.endsWith('s')) {
        target = tables.find(t => t.name.toLowerCase() === refBase.slice(0, -1));
      }
      if (!target) {
        target = tables.find(t => refBase + 's' === t.name.toLowerCase());
      }
      if (!target) {
        target = tables.find(t =>
          refBase.includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(refBase)
        );
      }

      if (!target || target.name === table.name) continue;
      if (isJunctionTable(table)) continue;

      const fromName = getOtName(table.name);
      const toName = getOtName(target.name);

      const fwdKey = `${table.name}|${col.name}|${target.name}`;
      if (!seen.has(fwdKey) && getOt(table.name) && getOt(target.name)) {
        seen.add(fwdKey);
        linkTypes.push({
          id: `lt::${table.name}_${col.name}`,
          name: `${fromName} 关联 ${toName}`,
          description: `每个「${fromName}」都关联一个「${toName}」`,
          fromObjectTypeId: getOtId(table.name),
          toObjectTypeId: getOtId(target.name),
          confidence: 0.95,
          reason: `发现字段 '${col.name}' 引用了「${toName}」`,
        });
      }

      const bwdKey = `${target.name}|back|${table.name}`;
      if (!seen.has(bwdKey) && getOt(table.name) && getOt(target.name)) {
        seen.add(bwdKey);
        linkTypes.push({
          id: `lt::${target.name}_back_${table.name}`,
          name: `${toName} 被 ${fromName} 引用`,
          description: `反向关系：每个「${fromName}」都关联一个「${toName}」`,
          fromObjectTypeId: getOtId(target.name),
          toObjectTypeId: getOtId(table.name),
          confidence: 0.85,
          reason: `由外键 '${col.name}' 逆向推断`,
        });
      }
    }

    // Junction tables
    if (isJunctionTable(table)) {
      const fkCols = table.columns.filter(c =>
        c.name.toLowerCase().endsWith('_id') || c.name.toLowerCase().endsWith('_ref')
      );
      if (fkCols.length >= 2) {
        const leftFk = singularize(fkCols[0].name.replace(/_id$/i, '').replace(/_ref$/i, '')).replace(/[_\-]/g, ' ');
        const rightFk = singularize(fkCols[1].name.replace(/_id$/i, '').replace(/_ref$/i, '')).replace(/[_\-]/g, ' ');

        const leftTarget = tables.find(t =>
          leftFk === t.name.toLowerCase() || t.name.toLowerCase().includes(leftFk)
        );
        const rightTarget = tables.find(t =>
          rightFk === t.name.toLowerCase() || t.name.toLowerCase().includes(rightFk)
        );

        if (leftTarget && rightTarget && leftTarget.name !== rightTarget.name) {
          const leftName = getOtName(leftTarget.name);
          const rightName = getOtName(rightTarget.name);
          linkTypes.push({
            id: `lt::junction_${table.name}_left`,
            name: `${leftName} 和 ${rightName} 有关联`,
            description: `通过「${table.name}」这张中间表，连接「${leftName}」和「${rightName}」`,
            fromObjectTypeId: getOtId(leftTarget.name),
            toObjectTypeId: getOtId(rightTarget.name),
            confidence: 0.9,
            reason: `「${table.name}」是关系表，两个字段分别指向「${leftName}」和「${rightName}」`,
          });
        }
      }
    }
  }

  // ── Fallback: name-pattern inference for tables with no FK columns detected ──
  // If linkTypes is still empty, try matching column names to table names directly.
  // e.g. a `country_id` in `users` referencing a `countries` table (or `country_id` referencing `country`).
  if (linkTypes.length === 0) {
    for (const table of tables) {
      for (const col of table.columns) {
        const colLower = col.name.toLowerCase();

        // Skip if this column already ended with _id/_ref (already handled in the main loop above)
        if (colLower.endsWith('_id') || colLower.endsWith('_ref')) continue;

        // Strip common suffixes to get the base entity name.
        // e.g. "country" from "country_id", "user_name" from "user_name"
        let baseName = colLower
          .replace(/_name$|_code$|_type$|_status$/, '')  // strip common attribute suffixes first
          .replace(/_/g, ' ').trim();

        // Try multiple forms of the base name:
        // 1. exact column name (e.g., "country" → "countries" table)
        // 2. singularized column name (e.g., "countries" → "countries" or "country")
        // 3. plural of column name (e.g., "country" → "countries")
        const singularCol = singularize(colLower);
        const pluralCol = singularCol + 's';

        let targetTable = tables.find(t => {
          if (t.name.toLowerCase() === table.name.toLowerCase()) return false;
          if (isJunctionTable(t)) return false;
          const tLower = t.name.toLowerCase();
          // Direct match
          if (tLower === colLower) return true;
          // Singular/plural match of column name
          if (tLower === singularCol) return true;
          if (tLower === pluralCol) return true;
          // Column name matches singularized table name
          if (singularCol === singularize(tLower).replace(/[_\-]/g, ' ')) return true;
          // Column is a prefix of table name (e.g., "country" in "countries")
          if (tLower.includes(colLower)) return true;
          // Table name is a prefix of column (e.g., "countries" in "country_id")
          if (colLower.includes(tLower.replace(/s$/, ''))) return true;
          return false;
        });

        if (!targetTable || !getOt(table.name) || !getOt(targetTable.name)) continue;

        const fwdKey = `${table.name}|${col.name}|${targetTable.name}`;
        if (seen.has(fwdKey)) continue;
        seen.add(fwdKey);

        const fromName = getOtName(table.name);
        const toName = getOtName(targetTable.name);
        linkTypes.push({
          id: `lt::${table.name}_${col.name}_namepat`,
          name: `${fromName} 关联 ${toName}`,
          description: `字段「${col.name}」的名字暗示与「${toName}」有关联`,
          fromObjectTypeId: getOtId(table.name),
          toObjectTypeId: getOtId(targetTable.name),
          confidence: 0.75,
          reason: `字段「${col.name}」与表「${targetTable.name}」名称相关联`,
        });

        // Reverse link
        const bwdKey = `${targetTable.name}|back|${table.name}`;
        if (!seen.has(bwdKey)) {
          seen.add(bwdKey);
          linkTypes.push({
            id: `lt::${targetTable.name}_back_${table.name}_namepat`,
            name: `${toName} 被 ${fromName} 引用`,
            description: `反向关联：每个「${fromName}」都关联一个「${toName}」`,
            fromObjectTypeId: getOtId(targetTable.name),
            toObjectTypeId: getOtId(table.name),
            confidence: 0.65,
            reason: `由字段「${col.name}」逆向推断与「${toName}」的关系`,
          });
        }
      }
    }
  }

  return linkTypes;
}

export function inferOntology(tables: TableInfo[]): InferredOntology {
  const objectTypes = inferObjectTypes(tables);
  const linkTypes = inferLinkTypes(tables, objectTypes);
  return { objectTypes, linkTypes };
}
