data = open('components/Library/OntologyInsightsPanel.tsx', 'rb').read()
lines = data.split(b'\n')
# Check ALL > on lines 600-603
for idx in [599, 600, 601, 602]:
    line = lines[idx]
    gt_positions = [i for i, b in enumerate(line) if b == 62]
    short = line[:60] + b'...' if len(line) > 60 else line
    print('Line %d (%d >): %r' % (idx+1, len(gt_positions), short))
    for pos in gt_positions:
        # Show context around each >
        ctx_start = max(0, pos-5)
        ctx_end = min(len(line), pos+6)
        print('  pos %d: context=%r' % (pos, line[ctx_start:ctx_end]))
