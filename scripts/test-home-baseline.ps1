param(
  [ValidateRange(1, 10)][int]$Repeat = 2,
  [switch]$Build,
  [string]$LogDirectory = 'docs/dashboard-component-closure-20261008'
)
$ErrorActionPreference = 'Stop'
function Invoke-LoggedPnpm([string[]]$CommandArguments, [string]$LogPath) {
  # Windows PowerShell 5 treats native stderr as an error record, even on exit 0.
  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    & pnpm.cmd @CommandArguments *> $LogPath
    return $LASTEXITCODE
  } finally { $ErrorActionPreference = $previousPreference }
}
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
  $baseline = Join-Path $projectRoot 'data/crud-lab/baseline.duckdb'
  $expectedHash = 'A16DB823884EF4C8A6056214C624EAF12FC12A454E31A93F2AB180B5948CC887'
  if ((Get-FileHash -LiteralPath $baseline -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Fixed funds baseline changed. Stop and review the baseline.' }
  if (-not (Get-Command duckdb -ErrorAction SilentlyContinue)) { throw 'DuckDB CLI is required for real source regression.' }
  $logs = Join-Path $projectRoot $LogDirectory
  New-Item -ItemType Directory -Force -Path $logs | Out-Null
  if ((Invoke-LoggedPnpm @('typecheck') (Join-Path $logs 'typecheck.log')) -ne 0) { throw 'Type check failed. See typecheck.log.' }
  $layers = [ordered]@{
    '1-foundation' = @(
    'services/workbench/fundsBaseline.integration.test.ts',
    'services/workbench/queryCompiler.test.ts',
    'services/workbench/runtime.test.ts',
    'services/dbService.dashboard.test.ts',
    'services/dynamicHome.test.ts',
    'services/homeDashboardService.test.ts'
    )
    '2-components' = @(
    'components/DashboardWidget.requests.test.tsx',
    'components/charts/ChartRenderer.visibility.test.tsx',
    'components/ui/useContainerWidth.test.tsx',
    'services/analysis/adapters/chartJsAdapter.test.ts',
    'services/analysis/adapters/dashboardWidgetAdapter.test.ts',
    'utils/chartSpace.test.ts', 'utils/tableSpace.test.ts'
    )
    '3-composition' = @(
    'components/Dashboard/Home/HomeLifecycle.test.tsx',
    'components/Dashboard/Home/WorkspaceObjects.test.tsx',
    'components/Dashboard/Home/DatasetPreview.requests.test.tsx',
    'components/DashboardGrid.layout.test.tsx',
    'components/DashboardGrid.interactions.test.tsx',
    'utils/dashboardLayout.test.ts'
    )
    '4-home' = @(
    'components/Dashboard.test.tsx',
    'components/Dashboard/MissionControl/DataIdeMissionControl.test.tsx',
    'components/Dashboard/MissionControl/DataIdeMissionControl.linkage.test.tsx'
    )
  }
  for ($round = 1; $round -le $Repeat; $round++) {
    $roundLog = Join-Path $logs "core-round-$round.log"
    Set-Content -LiteralPath $roundLog -Value "Layered regression round $round of $Repeat"
    foreach ($layer in $layers.Keys) {
      Write-Output "Round $round of $Repeat - $layer"
      $layerLog = Join-Path $logs "layer-$layer-round-$round.log"
      $result = Invoke-LoggedPnpm (@('exec','vitest','run','--pool=forks','--maxWorkers=1','--no-file-parallelism') + $layers[$layer]) $layerLog
      Get-Content -LiteralPath $layerLog | Add-Content -LiteralPath $roundLog
      if ($result -ne 0) { throw "Regression failed in $layer, round $round. Upper layers were not run. See the layer log." }
    }
  }
  Write-Output 'Finite real-source structure compatibility'
  if ((Invoke-LoggedPnpm @('exec','vitest','run','--pool=forks','--maxWorkers=1','services/workbench/homeCompatibility.integration.test.ts') (Join-Path $logs 'compatibility.log')) -ne 0) { throw 'Finite compatibility failed. See compatibility.log.' }
  if ($Build) {
    if ((Invoke-LoggedPnpm @('build') (Join-Path $logs 'build.log')) -ne 0) { throw 'Build failed. See build.log.' }
  }
  Write-Output 'Fixed funds component regression passed.'
} finally { Pop-Location }

