// --- Ontology Icons Helper ---
export const getTypeIcon = (type: string) => {
    const t = type.toUpperCase();
    if (t.includes('INT') || t.includes('FLOAT') || t.includes('DOUBLE') || t.includes('DECIMAL')) return '#️⃣';
    if (t.includes('CHAR') || t.includes('TEXT') || t.includes('STRING')) return '🔤';
    if (t.includes('DATE') || t.includes('TIME')) return '📅';
    if (t.includes('BOOL')) return '☯';
    if (t.includes('LIST') || t.includes('ARRAY')) return '📚';
    if (t.includes('STRUCT') || t.includes('MAP')) return '📦';
    if (t.includes('JSON')) return '📄';
    if (t.includes('BLOB')) return '💾';
    return '❓';
};
