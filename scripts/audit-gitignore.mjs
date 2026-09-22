#!/usr/bin/env node
/**
 * Fail if any tracked file matches .gitignore (common after rules are added late).
 * Usage: node scripts/audit-gitignore.mjs
 */
import { execFileSync } from 'node:child_process';

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean);
if (tracked.length === 0) {
  console.log('OK: no tracked files');
  process.exit(0);
}

// git check-ignore -v --stdin reads NUL-separated paths when -z is used
let ignoredOut = '';
try {
  ignoredOut = execFileSync('git', ['check-ignore', '-v', '-z', '--stdin'], {
    input: tracked.join('\0') + '\0',
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (err) {
  // exit 1 = none ignored (good); other codes are real failures
  if (err.status === 1) {
    console.log(`OK: ${tracked.length} tracked files, none match .gitignore`);
    process.exit(0);
  }
  console.error(err.stderr || err.message);
  process.exit(err.status ?? 1);
}

// -z output: <source> <NUL> <pattern> <NUL> <pathname> <NUL> ...
const parts = ignoredOut.split('\0').filter((p) => p.length > 0);
const violations = [];
for (let i = 0; i + 2 < parts.length; i += 3) {
  const source = parts[i];
  const pattern = parts[i + 1];
  const pathname = parts[i + 2];
  violations.push({ source, pattern, pathname });
}

if (violations.length === 0) {
  console.log(`OK: ${tracked.length} tracked files, none match .gitignore`);
  process.exit(0);
}

console.error(
  `FAIL: ${violations.length} tracked file(s) should be ignored.\n` +
    `Untrack with: git rm -r --cached <path>\n`,
);
for (const v of violations.slice(0, 50)) {
  console.error(`  ${v.pathname}  (${v.source}:${v.pattern})`);
}
if (violations.length > 50) {
  console.error(`  ... and ${violations.length - 50} more`);
}
process.exit(1);
