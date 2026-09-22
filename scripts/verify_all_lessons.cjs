const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '../data/ontology');
let hasError = false;

console.log('=== Step 1: Validating all 14 seed JSON files ===');
for (let i = 1; i <= 14; i++) {
  const pad = String(i).padStart(4, '0');
  const filename = `seed-lesson-${pad}.json`;
  const fullPath = path.join(dir, filename);
  
  if (!fs.existsSync(fullPath)) {
    console.error(`Missing file: ${filename}`);
    hasError = true;
    continue;
  }
  
  const d = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const objIds = new Set(d.objects.map(o => o.id));
  const typeIds = new Set(d.objectTypes.map(t => t.id));
  const linkTypeIds = new Set(d.linkTypes.map(lt => lt.id));
  
  // Check types
  if (d.objectTypes.length !== 2) {
    console.warn(`[${filename}] objectTypes count is ${d.objectTypes.length} (expected 2)`);
  }
  
  // Check object names and types
  d.objects.forEach(o => {
    if (!typeIds.has(o.object_type_id)) {
      console.error(`[${filename}] Object ${o.name} has invalid object_type_id: ${o.object_type_id}`);
      hasError = true;
    }
    if (o.name.length > 15) {
      console.error(`[${filename}] Object name too long (${o.name.length} chars): ${o.name}`);
      hasError = true;
    }
  });
  
  // Check links
  d.links.forEach(l => {
    if (!objIds.has(l.source_object_id)) {
      console.error(`[${filename}] Link ${l.id} has invalid source_object_id: ${l.source_object_id}`);
      hasError = true;
    }
    if (!objIds.has(l.target_object_id)) {
      console.error(`[${filename}] Link ${l.id} has invalid target_object_id: ${l.target_object_id}`);
      hasError = true;
    }
    if (!linkTypeIds.has(l.link_type_id)) {
      console.error(`[${filename}] Link ${l.id} has invalid link_type_id: ${l.link_type_id}`);
      hasError = true;
    }
  });
  
  // Check actions
  d.actions?.forEach(a => {
    if (!objIds.has(a.object_id)) {
      console.error(`[${filename}] Action ${a.name} has invalid object_id: ${a.object_id}`);
      hasError = true;
    }
  });
  
  // Check introspections
  d.introspections?.forEach(intro => {
    if (!objIds.has(intro.object_id)) {
      console.error(`[${filename}] Introspection has invalid object_id: ${intro.object_id}`);
      hasError = true;
    }
  });
  
  console.log(`✓ ${filename}: ${d.objects.length} objects, ${d.links.length} links, ${d.objectTypes.length} types. Names: ${d.objects.map(o => o.name).join(' | ')}`);
}

console.log('\n=== Step 2: Validating defaultPatterns.ts alignment ===');
const defaultPatternsPath = path.resolve(__dirname, '../components/Library/defaultPatterns.ts');
const patternContent = fs.readFileSync(defaultPatternsPath, 'utf8');

for (let i = 1; i <= 14; i++) {
  const pad = String(i).padStart(4, '0');
  const filename = `seed-lesson-${pad}.json`;
  const d = JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8'));
  
  // Match lesson in patternContent
  const lessonRegex = new RegExp(`id:\\s*'lesson-${pad}',[\\s\\S]*?nodeCount:\\s*(\\d+),[\\s\\S]*?linkCount:\\s*(\\d+)`);
  const match = patternContent.match(lessonRegex);
  if (!match) {
    console.error(`Could not find lesson-${pad} in defaultPatterns.ts`);
    hasError = true;
  } else {
    const nodeCount = parseInt(match[1], 10);
    const linkCount = parseInt(match[2], 10);
    if (nodeCount !== d.objects.length) {
      console.error(`lesson-${pad} nodeCount mismatch: pattern=${nodeCount}, seed=${d.objects.length}`);
      hasError = true;
    }
    if (linkCount !== d.links.length) {
      console.error(`lesson-${pad} linkCount mismatch: pattern=${linkCount}, seed=${d.links.length}`);
      hasError = true;
    }
    console.log(`✓ lesson-${pad} aligned: nodeCount=${nodeCount}, linkCount=${linkCount}`);
  }
}

if (hasError) {
  console.error('\nVerification failed with errors!');
  process.exit(1);
} else {
  console.log('\nALL CHECKS PASSED PERFECTLY!');
}
