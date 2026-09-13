<#
  Rendezi es atnevezi a legyartott szinkronhang fajlokat a viki/ es kristof/ almappakba.

  Szabaly: "clipId.<ext>"   -> viki/clipId.<ext>
           "clipId1.<ext>"  -> kristof/clipId.<ext>

  A relic_reject kulon kezelt eset: a mappaban 3 db azonos (byte-egyezo) "relic_reject"
  felvetel volt (relic_reject.m4a, "relic_reject (1).m4a", "relic_reject (2).m4a"), plusz
  a valodi masodik felvetel "relic_reject1.m4a" neven. Ezert:
    relic_reject.m4a       -> viki/relic_reject.<ext>
    relic_reject1.m4a      -> kristof/relic_reject.<ext>
    relic_reject (1).m4a   -> a forrasmappaban marad (duplikatum, nem torlodik automatikusan)
    relic_reject (2).m4a   -> a forrasmappaban marad (duplikatum, nem torlodik automatikusan)

  Hasznalat: futtasd ebbol a mappabol (public/audio/voice), vagy add meg -SourceFolder-rel.
#>

param(
  [string]$SourceFolder = (Join-Path $PSScriptRoot '..\public\audio\voice')
)

$SourceFolder = (Resolve-Path $SourceFolder).Path
$vikiDir = Join-Path $SourceFolder 'viki'
$kristofDir = Join-Path $SourceFolder 'kristof'
New-Item -ItemType Directory -Force -Path $vikiDir | Out-Null
New-Item -ItemType Directory -Force -Path $kristofDir | Out-Null

$clipIds = @(
  'paranoia_high',
  'pin_correct',
  'pin_wrong',
  'push_effort',
  'push_struggle',
  'push_success',
  'relic_pickup',
  'relic_reject',
  'tether_warn'
)

function Move-Clip {
  param([string]$SourceFile, [string]$DestDir, [string]$ClipId)
  $ext = [System.IO.Path]::GetExtension($SourceFile)
  $destPath = Join-Path $DestDir "$ClipId$ext"
  Move-Item -LiteralPath $SourceFile -Destination $destPath -Force
  Write-Host "  OK: $([System.IO.Path]::GetFileName($SourceFile)) -> $destPath"
}

foreach ($clipId in $clipIds) {
  Write-Host "Feldolgozas: $clipId"

  $vikiSource = Get-ChildItem -LiteralPath $SourceFolder -File -ErrorAction SilentlyContinue |
    Where-Object { $_.BaseName -eq $clipId }
  if ($vikiSource) {
    Move-Clip -SourceFile $vikiSource.FullName -DestDir $vikiDir -ClipId $clipId
  } else {
    Write-Warning "  Hianyzik: '$clipId' (Viki) a forrasmappaban."
  }

  $kristofBase = $clipId + '1'
  $kristofSource = Get-ChildItem -LiteralPath $SourceFolder -File -ErrorAction SilentlyContinue |
    Where-Object { $_.BaseName -eq $kristofBase }
  if ($kristofSource) {
    Move-Clip -SourceFile $kristofSource.FullName -DestDir $kristofDir -ClipId $clipId
  } else {
    Write-Warning "  Hianyzik: '$kristofBase' (Kristof) a forrasmappaban."
  }
}

Write-Host ""
$leftoverDupes = Get-ChildItem -LiteralPath $SourceFolder -File -ErrorAction SilentlyContinue |
  Where-Object { $_.BaseName -match '^relic_reject \(\d+\)$' }
if ($leftoverDupes) {
  Write-Host "Ezek duplikatumok maradtak a forrasmappaban (nem lettek mozgatva):"
  foreach ($f in $leftoverDupes) { Write-Host "  - $($f.Name)" }
  Write-Host "Ha nem kellenek, kezzel torolheted oket."
}

Write-Host ""
Write-Host "Kesz."
