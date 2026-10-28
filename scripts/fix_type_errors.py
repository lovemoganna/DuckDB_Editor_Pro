"""Fix TypeScript discriminated union narrowing errors in analysis files."""
import re
import os

# Helper: replace ${v.error} with properly typed cast
def add_cast(line, varname):
    old = '${' + varname + '.error}'
    new = '${(' + varname + ' as { ok: false; error: string }).error}'
    return line.replace(old, new)

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    changed = False
    for i, line in enumerate(lines):
        m = re.search(r'if \(!(\w+)\.ok\)', line)
        if m:
            varname = m.group(1)
            # Fix same line
            fixed = add_cast(line, varname)
            if fixed != line:
                lines[i] = fixed
                changed = True
            # Fix next line
            if i + 1 < len(lines):
                fixed_next = add_cast(lines[i + 1], varname)
                if fixed_next != lines[i + 1]:
                    lines[i + 1] = fixed_next
                    changed = True
    
    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print(f'Fixed: {filepath}')
    else:
        print(f'No changes needed: {filepath}')

files = [
    'services/analysis/aiIntent.ts',
    'services/analysis/calcCompiler.ts',
    'services/analysis/sqlCompiler.ts',
]

for f in files:
    fix_file(f)

print('All done.')
