data = open('components/Library/OntologyInsightsPanel.tsx', 'rb').read()
lines = data.split(b'\n')

# For each line that TS reported, check: does the previous line end with '>'?
# And does the next line NOT start with a closing tag that would indicate the > was there?
check_lines = [600, 622, 673, 737]  # TS line numbers (1-indexed)
for ts_line in check_lines:
    idx = ts_line - 1
    prev_line = lines[idx-1] if idx > 0 else b''
    curr_line = lines[idx]
    next_line = lines[idx+1] if idx+1 < len(lines) else b''
    
    prev_ends_gt = prev_line.rstrip().endswith(b'>')
    next_starts_slash = next_line.lstrip().startswith(b'</')
    
    print('TS line %d (idx %d):' % (ts_line, idx))
    print('  prev ends with >?: %s' % prev_ends_gt)
    print('  prev: %r' % (prev_line[-50:] if len(prev_line) > 50 else prev_line))
    print('  curr: %r' % (curr_line[:80]))
    print('  next starts with </?: %s' % next_starts_slash)
    print('  next: %r' % (next_line[:60]))
    print()
