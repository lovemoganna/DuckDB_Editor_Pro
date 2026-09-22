/**
 * typeFormatter.ts — Unified DuckDB Data Type Formatter & Metadata Resolver
 *
 * Core Principles:
 * 1. Database is the single source of truth for "what type data is".
 *    The result table is responsible for "how that type should be rendered".
 * 2. Column type metadata (NOT column names) is the SOLE basis for formatting.
 *    E.g. A column named `created_at` with type `BIGINT` stays as raw BIGINT (`1788015989808`).
 * 3. Identifiers, IDs, and integer types NEVER use forced thousand separators (`1001` stays `1001`).
 * 4. Separation of display representation and raw values:
 *    - UI renders formatted values for readability.
 *    - Copy, export, sort, and filter always operate on true raw values.
 */

export interface FormatterOptions {
  maxDecimals?: number;
  nullPlaceholder?: string;
}

/**
 * Normalizes Arrow/DuckDB/SQL data types to canonical DuckDB SQL types.
 */
export function normalizeDuckDBType(rawType?: string | null): string {
  if (!rawType) return 'VARCHAR';
  const t = rawType.trim().toUpperCase();

  // Integers
  if (t === 'INT' || t === 'INTEGER' || t === 'INT4' || t === 'INT32' || t === 'SIGNED') return 'INTEGER';
  if (t === 'BIGINT' || t === 'INT8' || t === 'INT64' || t === 'LONG') return 'BIGINT';
  if (t === 'SMALLINT' || t === 'INT2' || t === 'INT16' || t === 'SHORT') return 'SMALLINT';
  if (t === 'TINYINT' || t === 'INT1') return 'TINYINT';
  if (t === 'HUGEINT' || t === 'INT128') return 'HUGEINT';
  if (t === 'UTINYINT' || t === 'UINT8') return 'UTINYINT';
  if (t === 'USMALLINT' || t === 'UINT16') return 'USMALLINT';
  if (t === 'UINTEGER' || t === 'UINT32' || t === 'UINT') return 'UINTEGER';
  if (t === 'UBIGINT' || t === 'UINT64' || t === 'ULONG') return 'UBIGINT';
  if (t === 'UHUGEINT' || t === 'UINT128') return 'UHUGEINT';

  // Floats & Decimals
  if (t === 'FLOAT' || t === 'FLOAT4' || t === 'FLOAT32' || t === 'REAL') return 'FLOAT';
  if (t === 'DOUBLE' || t === 'FLOAT8' || t === 'FLOAT64' || t === 'DOUBLE PRECISION') return 'DOUBLE';
  if (t.startsWith('DECIMAL') || t.startsWith('NUMERIC')) return t;

  // Text & String
  if (t === 'VARCHAR' || t === 'TEXT' || t === 'STRING' || t === 'CHAR' || t === 'BPCHAR' || t === 'UTF8') return 'VARCHAR';

  // Booleans
  if (t === 'BOOLEAN' || t === 'BOOL' || t === 'LOGICAL') return 'BOOLEAN';

  // Temporal
  if (t.startsWith('TIMESTAMPTZ') || t.includes('WITH TIME ZONE')) return 'TIMESTAMPTZ';
  if (t.startsWith('TIMESTAMP') || t === 'DATETIME') return 'TIMESTAMP';
  if (t === 'DATE') return 'DATE';
  if (t.startsWith('TIME')) return 'TIME';
  if (t.startsWith('INTERVAL')) return 'INTERVAL';

  // Binary & Complex
  if (t === 'BLOB' || t === 'BYTEA' || t === 'BINARY' || t === 'VARBINARY') return 'BLOB';
  if (t.endsWith('[]') || t.startsWith('LIST')) return 'LIST';
  if (t.startsWith('STRUCT')) return 'STRUCT';
  if (t.startsWith('MAP')) return 'MAP';
  if (t === 'JSON') return 'JSON';
  if (t === 'UUID') return 'UUID';

  return t;
}

/**
 * Maps Apache Arrow DataType object or string to canonical DuckDB SQL type string.
 */
export function arrowTypeToDuckDBType(type: any): string {
  if (!type) return 'VARCHAR';
  if (typeof type === 'string') return normalizeDuckDBType(type);

  const cName = type.constructor?.name || '';
  const typeStr = typeof type.toString === 'function' ? type.toString() : '';

  if (cName === 'Int8') return 'TINYINT';
  if (cName === 'Int16') return 'SMALLINT';
  if (cName === 'Int32') return 'INTEGER';
  if (cName === 'Int64') return 'BIGINT';
  if (cName === 'Uint8') return 'UTINYINT';
  if (cName === 'Uint16') return 'USMALLINT';
  if (cName === 'Uint32') return 'UINTEGER';
  if (cName === 'Uint64') return 'UBIGINT';
  if (cName === 'Float16' || cName === 'Float32') return 'FLOAT';
  if (cName === 'Float64') return 'DOUBLE';
  if (cName === 'Utf8' || cName === 'LargeUtf8') return 'VARCHAR';
  if (cName === 'Bool') return 'BOOLEAN';
  if (cName.startsWith('Date')) return 'DATE';
  if (cName.startsWith('Timestamp')) {
    return type.timezone ? 'TIMESTAMPTZ' : 'TIMESTAMP';
  }
  if (cName.startsWith('Time')) return 'TIME';
  if (cName === 'Decimal') {
    if (type.precision !== undefined && type.scale !== undefined) {
      return `DECIMAL(${type.precision},${type.scale})`;
    }
    return 'DECIMAL';
  }
  if (cName.includes('List')) return 'LIST';
  if (cName === 'Struct') return 'STRUCT';
  if (cName === 'Map_') return 'MAP';
  if (cName.includes('Binary')) return 'BLOB';
  if (cName.includes('Interval')) return 'INTERVAL';

  // Pattern matching on type string
  if (/^int8\b/i.test(typeStr)) return 'TINYINT';
  if (/^int16\b/i.test(typeStr)) return 'SMALLINT';
  if (/^int32\b/i.test(typeStr)) return 'INTEGER';
  if (/^int64\b/i.test(typeStr)) return 'BIGINT';
  if (/^uint8\b/i.test(typeStr)) return 'UTINYINT';
  if (/^uint16\b/i.test(typeStr)) return 'USMALLINT';
  if (/^uint32\b/i.test(typeStr)) return 'UINTEGER';
  if (/^uint64\b/i.test(typeStr)) return 'UBIGINT';
  if (/^float(32|16)\b/i.test(typeStr)) return 'FLOAT';
  if (/^float64\b/i.test(typeStr)) return 'DOUBLE';
  if (/^utf8\b|^largeutf8\b|^string\b/i.test(typeStr)) return 'VARCHAR';
  if (/^bool\b/i.test(typeStr)) return 'BOOLEAN';
  if (/^timestamp/i.test(typeStr)) {
    return typeStr.includes('tz') || typeStr.includes('+') ? 'TIMESTAMPTZ' : 'TIMESTAMP';
  }
  if (/^date/i.test(typeStr)) return 'DATE';
  if (/^time/i.test(typeStr)) return 'TIME';
  if (/^decimal/i.test(typeStr)) {
    const match = typeStr.match(/decimal<(\d+),\s*(\d+)>/i);
    if (match) return `DECIMAL(${match[1]},${match[2]})`;
    return 'DECIMAL';
  }

  return normalizeDuckDBType(typeStr);
}

/**
 * Format a Date object into YYYY-MM-DD HH:mm:ss[.SSS]
 */
function formatDateObject(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  const ms = d.getMilliseconds();
  const msStr = ms > 0 ? `.${String(ms).padStart(3, '0')}` : '';
  return `${y}-${m}-${day} ${h}:${min}:${sec}${msStr}`;
}

/**
 * Format timestamp values (number / Date / ISO string) to `YYYY-MM-DD HH:mm:ss[.SSS]`
 */
export function formatTimestamp(val: any): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    return formatDateObject(val);
  }

  if (typeof val === 'number') {
    let ms = val;
    // Microseconds detection: e.g. > 1e14
    if (Math.abs(val) > 1e14) {
      ms = Math.round(val / 1000);
    } else if (Math.abs(val) < 1e11) {
      // Seconds detection: e.g. < 1e11
      ms = val * 1000;
    }
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      return formatDateObject(d);
    }
    return String(val);
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      if (!isNaN(num)) return formatTimestamp(num);
    }

    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(trimmed)) {
      return trimmed.replace('T', ' ');
    }

    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return formatDateObject(d);
    }
    return trimmed;
  }

  if (typeof val === 'bigint') {
    if (val > 100000000000000000n || val < -100000000000000000n) {
      // Nanoseconds: divide by 1_000_000n
      return formatTimestamp(Number(val / 1000000n));
    }
    if (val > 100000000000000n || val < -100000000000000n) {
      // Microseconds: divide by 1000n
      return formatTimestamp(Number(val / 1000n));
    }
    const num = Number(val);
    if (num <= Number.MAX_SAFE_INTEGER && num >= Number.MIN_SAFE_INTEGER) {
      return formatTimestamp(num);
    }
  }

  return String(val);
}

/**
 * Format date values to `YYYY-MM-DD`
 */
export function formatDate(val: any): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  if (typeof val === 'bigint') {
    return formatDate(Number(val));
  }

  if (typeof val === 'number') {
    // If it is days since epoch (e.g. < 100000)
    let ms = val;
    if (Math.abs(val) < 100000) {
      ms = val * 86400000;
      const d = new Date(ms);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.substring(0, 10);
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return trimmed;
  }

  return String(val);
}

/**
 * Format time values to `HH:mm:ss`
 */
export function formatTime(val: any): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    const h = String(val.getHours()).padStart(2, '0');
    const min = String(val.getMinutes()).padStart(2, '0');
    const s = String(val.getSeconds()).padStart(2, '0');
    return `${h}:${min}:${s}`;
  }

  if (typeof val === 'number') {
    let sTotal = val;
    if (val > 86400000000) {
      sTotal = Math.floor(val / 1000000);
    } else if (val > 86400000) {
      sTotal = Math.floor(val / 1000);
    } else if (val > 86400) {
      sTotal = Math.floor(val / 1000);
    }
    const h = String(Math.floor((sTotal / 3600) % 24)).padStart(2, '0');
    const m = String(Math.floor((sTotal / 60) % 60)).padStart(2, '0');
    const s = String(Math.floor(sTotal % 60)).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{2}:\d{2}(:\d{2})?/.test(trimmed)) {
      return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
    }
    return trimmed;
  }

  return String(val);
}

/**
 * Format integer values without forced thousand separators (e.g. `1001` -> `"1001"`)
 */
export function formatInteger(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'bigint') return val.toString();
  if (typeof val === 'number') return Math.trunc(val).toString();
  return String(val);
}

/**
 * Format decimal/double values without forced commas
 */
export function formatDecimal(val: any, maxDecimals?: number): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    if (isNaN(val)) return 'NaN';
    if (!isFinite(val)) return val > 0 ? 'Infinity' : '-Infinity';
    if (typeof maxDecimals === 'number') {
      return Number(val.toFixed(maxDecimals)).toString();
    }
    return val.toString();
  }
  return String(val);
}

/**
 * Format boolean values to `true` / `false`
 */
export function formatBoolean(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (val === 1 || val === '1' || String(val).toLowerCase() === 'true') return 'true';
  if (val === 0 || val === '0' || String(val).toLowerCase() === 'false') return 'false';
  return String(val);
}

/**
 * Unified Cell Formatter.
 *
 * Formats data based EXCLUSIVELY on DuckDB column type metadata.
 */
export function formatCellValue(
  value: any,
  columnType?: string,
  options?: FormatterOptions
): string {
  if (value === null || value === undefined) {
    return options?.nullPlaceholder ?? 'NULL';
  }

  const normType = normalizeDuckDBType(columnType || '');

  switch (normType) {
    case 'VARCHAR':
    case 'TEXT':
    case 'STRING':
      return typeof value === 'object' ? JSON.stringify(value) : String(value);

    case 'INTEGER':
    case 'BIGINT':
    case 'SMALLINT':
    case 'TINYINT':
    case 'HUGEINT':
    case 'UTINYINT':
    case 'USMALLINT':
    case 'UINTEGER':
    case 'UBIGINT':
    case 'UHUGEINT':
      return formatInteger(value);

    case 'FLOAT':
    case 'DOUBLE':
      return formatDecimal(value, options?.maxDecimals);

    case 'BOOLEAN':
      return formatBoolean(value);

    case 'TIMESTAMP':
    case 'TIMESTAMPTZ':
      return formatTimestamp(value);

    case 'DATE':
      return formatDate(value);

    case 'TIME':
      return formatTime(value);

    default:
      if (normType.startsWith('DECIMAL') || normType.startsWith('NUMERIC')) {
        return formatDecimal(value, options?.maxDecimals);
      }
      if (typeof value === 'bigint') {
        return value.toString();
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
  }
}

