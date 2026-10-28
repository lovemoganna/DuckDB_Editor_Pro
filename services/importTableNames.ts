/** Clean string into a valid SQL identifier using DuckDB rules */
export function cleanIdentifier(value: string): string {
  const name = value.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_').replace(/^_+/, '') || 'imported';
  return /^\d/.test(name) ? `_${name}` : name;
}

/** Check if a sheet name is a generic default Excel sheet name (e.g. Sheet1, 工作表1) */
export function isGenericSheetName(name: string): boolean {
  return /^(sheet\s*\d+|工作表\s*\d+|table\s*\d+|页\s*\d+)$/i.test(name.trim());
}

/**
 * Allocate table names for Excel sheets without prepending the Excel workbook/file name prefix.
 * - For multi-sheet workbooks: uses each sheet's clean name, resolving collisions.
 * - For single-sheet workbooks: uses the sheet name if custom, or the workbook file name if the sheet name is generic.
 */
export function allocateExcelTableNames(
  sheets: { name: string }[],
  fileName?: string
): string[] {
  if (sheets.length === 0) return [];

  const baseFileName = fileName
    ? fileName.split('?')[0].split('#')[0].split('/').pop()?.split('\\').pop()?.split('.')[0]
    : '';
  const cleanBase = baseFileName ? cleanIdentifier(baseFileName) : '';

  if (sheets.length === 1) {
    const sheetName = sheets[0].name;
    if (isGenericSheetName(sheetName) && cleanBase) {
      return [cleanBase];
    }
    return [cleanIdentifier(sheetName)];
  }

  const stems = sheets.map((sheet, idx) => cleanIdentifier(sheet.name) || `sheet_${idx + 1}`);
  const reserved = new Set(stems.map(name => name.toLowerCase()));
  const used = new Set<string>();

  return stems.map((stem) => {
    let name = stem;
    if (used.has(name.toLowerCase())) {
      let suffix = 2;
      while (used.has(`${stem}_${suffix}`.toLowerCase()) || reserved.has(`${stem}_${suffix}`.toLowerCase())) {
        suffix++;
      }
      name = `${stem}_${suffix}`;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

/** Allocate identifiers using DuckDB's case-insensitive name rules. */
export function allocateImportTableNames(base: string, sources: { schema?: string; name: string }[]): string[] {
  const clean = cleanIdentifier;
  const prefix = clean(base);
  const stems = sources.map(source => sources.length === 1 ? prefix : `${prefix}_${clean(source.name)}`);
  const reserved = new Set(stems.map(name => name.toLowerCase()));
  const used = new Set<string>();
  return stems.map((stem, index) => {
    let name = stem;
    if (used.has(name.toLowerCase())) {
      const qualified = sources[index].schema ? `${stem}_${clean(sources[index].schema!)}` : stem;
      name = qualified;
      let suffix = 2;
      while (used.has(name.toLowerCase()) || reserved.has(name.toLowerCase())) name = `${qualified}_${suffix++}`;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

