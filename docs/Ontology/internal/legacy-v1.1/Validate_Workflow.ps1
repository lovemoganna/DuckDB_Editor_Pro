[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()

function Add-Failure {
    param([string]$Message)
    $failures.Add($Message)
}

function Read-Text {
    param([string]$Name)
    $path = Join-Path $root $Name
    if (-not (Test-Path -LiteralPath $path)) {
        Add-Failure "Missing file: $Name"
        return ''
    }
    return [IO.File]::ReadAllText($path)
}

function Get-Field {
    param(
        [string]$Text,
        [string]$Name
    )
    $match = [regex]::Match($Text, "(?m)^$([regex]::Escape($Name)):\s*(.+?)\s*$")
    if (-not $match.Success) {
        return ''
    }
    return $match.Groups[1].Value
}

function Get-Section {
    param(
        [string]$Text,
        [string]$Heading
    )
    $pattern = "(?ms)^###\s+$([regex]::Escape($Heading))\s*\r?\n(.*?)(?=^###\s+|\z)"
    $match = [regex]::Match($Text, $pattern)
    if (-not $match.Success) {
        return ''
    }
    return $match.Groups[1].Value
}

function Get-Ids {
    param(
        [string]$Text,
        [string]$Prefix
    )
    $matches = [regex]::Matches(
        $Text,
        "(?m)^\|\s*($([regex]::Escape($Prefix))-\d{2})\s*\|"
    )
    return @($matches | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
}

function Compare-IdSets {
    param(
        [string]$Name,
        [string[]]$Expected,
        [string[]]$Actual
    )
    $difference = @(Compare-Object -ReferenceObject $Expected -DifferenceObject $Actual)
    if ($difference.Count -gt 0) {
        Add-Failure "$Name ID sets differ: $($difference | Out-String)"
    }
}

function Require-Match {
    param(
        [string]$Name,
        [string]$Text,
        [string]$Pattern
    )
    if ($Text -notmatch $Pattern) {
        Add-Failure "$Name failed required check: $Pattern"
    }
}

$requiredFiles = @(
    'index.md',
    'Run_Manifest.md',
    'Step_1_Prompts.md',
    'Step_2_Prompts.md',
    'Step_3_Prompts.md',
    'Step_4_Prompts.md',
    'Step_1_Fact_Baseline.md',
    'Step_2_Ontology_Design.md',
    'Step_3_Reuse_Test.md',
    'Ontology_Tutorial.md',
    'Step_4_Quality_Report.md'
)

$texts = @{}
foreach ($file in $requiredFiles) {
    $texts[$file] = Read-Text $file
}

if (Test-Path -LiteralPath (Join-Path $root 'Step_3_Quality_Report.md')) {
    Add-Failure 'Obsolete artifact exists: Step_3_Quality_Report.md'
}

$manifest = $texts['Run_Manifest.md']
$runId = Get-Field $manifest 'run_id'
$workflowVersion = Get-Field $manifest 'workflow_version'

if ([string]::IsNullOrWhiteSpace($runId)) {
    Add-Failure 'Run_Manifest.md has no run_id'
}
if ($workflowVersion -ne '1.1.0') {
    Add-Failure "Unsupported workflow_version: $workflowVersion"
}
if ((Get-Field $manifest 'status') -ne 'PASS') {
    Add-Failure 'Run_Manifest.md status is not PASS'
}
if ((Get-Field $manifest 'blind_fixture_status') -ne 'LOCKED_BEFORE_MODEL') {
    Add-Failure 'Blind fixture was not locked before modeling'
}

$stageContracts = @(
    @{ File = 'Step_1_Fact_Baseline.md'; Stage = 'Step 1'; Gate = 'G1' },
    @{ File = 'Step_2_Ontology_Design.md'; Stage = 'Step 2'; Gate = 'G2' },
    @{ File = 'Step_3_Reuse_Test.md'; Stage = 'Step 3'; Gate = 'G3' },
    @{ File = 'Step_4_Quality_Report.md'; Stage = 'Step 4'; Gate = 'G4' }
)

foreach ($contract in $stageContracts) {
    $text = $texts[$contract.File]
    if ((Get-Field $text 'run_id') -ne $runId) {
        Add-Failure "$($contract.File) run_id does not match Manifest"
    }
    if ((Get-Field $text 'stage') -ne $contract.Stage) {
        Add-Failure "$($contract.File) has wrong stage"
    }
    if ((Get-Field $text 'status') -ne 'PASS') {
        Add-Failure "$($contract.File) status is not PASS"
    }
    if ((Get-Field $text 'gate') -ne $contract.Gate) {
        Add-Failure "$($contract.File) has wrong gate"
    }
}

$design = $texts['Step_2_Ontology_Design.md']
$blindTest = $texts['Step_3_Reuse_Test.md']
$modelVersion = Get-Field $design 'model_version'

if ([string]::IsNullOrWhiteSpace($modelVersion)) {
    Add-Failure 'Step_2_Ontology_Design.md has no model_version'
}
if ((Get-Field $blindTest 'model_version') -ne $modelVersion) {
    Add-Failure 'Blind test did not use the frozen model version'
}
if ((Get-Field $blindTest 'test_mode') -ne 'BLIND') {
    Add-Failure 'Step 3 test_mode is not BLIND'
}
if ((Get-Field $blindTest 'model_frozen_before_test') -ne 'true') {
    Add-Failure 'Model was not frozen before the blind test'
}

$acceptanceSection = Get-Section $manifest 'acceptance_questions'
$expectedSection = Get-Section $manifest 'expected_answers'
$manifestCqs = Get-Ids $acceptanceSection 'CQ'
$expectedCqs = Get-Ids $expectedSection 'CQ'
$designCqs = Get-Ids $design 'CQ'

if ($manifestCqs.Count -eq 0) {
    Add-Failure 'Manifest has no acceptance questions'
}
Compare-IdSets 'Manifest questions vs expected answers' $manifestCqs $expectedCqs
Compare-IdSets 'Manifest questions vs model questions' $manifestCqs $designCqs

$verdictPattern = '(?m)^\|\s*(CQ-\d{2})\s*\|\s*[^|\r\n]+\|\s*[^|\r\n]+\|\s*(MATCH|MISMATCH)\s*\|\s*$'
$verdictRows = [regex]::Matches($blindTest, $verdictPattern)
$verdictCqs = @($verdictRows | ForEach-Object { $_.Groups[1].Value })
$uniqueVerdictCqs = @($verdictCqs | Sort-Object -Unique)

Compare-IdSets 'Model questions vs blind-test verdicts' $designCqs $uniqueVerdictCqs
if ($verdictRows.Count -ne $uniqueVerdictCqs.Count) {
    Add-Failure 'Blind test contains duplicate CQ verdict rows'
}

$mismatches = @($verdictRows | Where-Object { $_.Groups[2].Value -eq 'MISMATCH' })
if ($mismatches.Count -gt 0) {
    Add-Failure "Blind test contains $($mismatches.Count) MISMATCH verdict(s)"
}

$definedModelIds = @(
    [regex]::Matches(
        $design,
        '(?m)^\|\s*((?:OT|PT|RT|ST|REL|CON)-[A-Z0-9_]+)\s*\|'
    ) | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
)
$referencedModelIds = @(
    [regex]::Matches(
        $blindTest,
        '\b(?:OT|PT|RT|ST|REL|CON)-[A-Z0-9_]+\b'
    ) | ForEach-Object { $_.Value } | Sort-Object -Unique
)

foreach ($id in $referencedModelIds) {
    if ($definedModelIds -notcontains $id) {
        Add-Failure "Blind test references undefined model ID: $id"
    }
}

Require-Match 'Step_3_Reuse_Test.md' $blindTest '8/8 MATCH'
Require-Match 'Step_3_Reuse_Test.md' $blindTest '0 MISMATCH'
Require-Match 'Step_4_Quality_Report.md' $texts['Step_4_Quality_Report.md'] '8/8 MATCH'
Require-Match 'Step_4_Quality_Report.md' $texts['Step_4_Quality_Report.md'] '0 MISMATCH'

$tutorial = $texts['Ontology_Tutorial.md']
$nonWhitespace = ([regex]::Replace($tutorial, '\s', '')).Length
if ($nonWhitespace -lt 3500 -or $nonWhitespace -gt 4800) {
    Add-Failure "Ontology_Tutorial.md length $nonWhitespace is outside 3500-4800"
}

$mermaidBlocks = [regex]::Matches(
    $tutorial,
    '(?s)\x60{3}mermaid\s+.*?\x60{3}'
).Count
if ($mermaidBlocks -ne 1) {
    Add-Failure "Ontology_Tutorial.md must contain exactly one Mermaid block; found $mermaidBlocks"
}

$blocks = [regex]::Split($tutorial, '\r?\n\s*\r?\n')
foreach ($block in $blocks) {
    $flat = [regex]::Replace($block, '\s+', ' ')
    $isParagraph = (
        $flat -notmatch '^\|' -and
        $flat -notmatch '^#' -and
        $flat -notmatch '^(\d+\.|-|>) ' -and
        $flat -notmatch '^\x60{3}' -and
        $flat -notmatch '^~~~'
    )
    if ($isParagraph -and $flat.Length -gt 240) {
        Add-Failure 'Ontology_Tutorial.md has a prose paragraph longer than 240 characters'
        break
    }
}

foreach ($file in Get-ChildItem -LiteralPath $root -Filter '*.md' -File) {
    $text = [IO.File]::ReadAllText($file.FullName)
    if ($text -match '(?m)[ \t]+$') {
        Add-Failure "$($file.Name) contains trailing whitespace"
    }
    $fenceLines = [regex]::Matches($text, '(?m)^(~~~|\x60{3})').Count
    if ($fenceLines % 2 -ne 0) {
        Add-Failure "$($file.Name) has unbalanced code fences"
    }
}

$nodeScript = @'
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<div id="app"></div>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
});

const domPurifyModule = (await import('dompurify')).default;
globalThis.DOMPurify =
  typeof domPurifyModule === 'function' && !domPurifyModule.addHook
    ? domPurifyModule(dom.window)
    : domPurifyModule;

const mermaid = (await import('mermaid')).default;
const text = fs.readFileSync('Ontology_Tutorial.md', 'utf8');
const fence = String.fromCharCode(96).repeat(3);
const code = text.split(fence + 'mermaid')[1].split(fence)[0];
await mermaid.parse(code);
'@

Push-Location $root
try {
    & node --input-type=module -e $nodeScript
    if ($LASTEXITCODE -ne 0) {
        Add-Failure 'Mermaid parser rejected Ontology_Tutorial.md'
    }
}
catch {
    Add-Failure "Mermaid validation failed: $($_.Exception.Message)"
}
finally {
    Pop-Location
}

if ($failures.Count -gt 0) {
    Write-Host 'WORKFLOW VALIDATION: FAIL'
    foreach ($failure in $failures) {
        Write-Host " - $failure"
    }
    exit 1
}

Write-Host 'WORKFLOW VALIDATION: PASS'
Write-Host " - run_id: $runId"
Write-Host " - required artifacts: $($requiredFiles.Count)"
Write-Host " - CQ set alignment: $($designCqs.Count)/$($designCqs.Count)"
Write-Host " - blind acceptance: $($verdictRows.Count)/$($verdictRows.Count) MATCH"
Write-Host ' - model references: PASS'
Write-Host ' - Mermaid syntax: PASS'
Write-Host " - tutorial non-whitespace characters: $nonWhitespace"
exit 0
