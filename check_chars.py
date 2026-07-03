data = open('components/Library/OntologyInsightsPanel.tsx', 'rb').read()
lines = data.split(b'\n')
print('BOM:', repr(data[:4]))
print('Total lines:', len(lines))

for i in range(594, 610):
    if i < len(lines):
        line = lines[i]
        bad = [(j, b) for j, b in enumerate(line) if b < 9 or (13 < b < 32) or b == 127]
        if bad:
            print(f'Line {i+1} has bad chars: {bad}')
        else:
            print(f'Line {i+1}: OK')
