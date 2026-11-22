# 用同一隻狗的影片畫面，比較三種做法：只用側面、形狀用側面＋外觀用三個角度、三個角度一起融合。
param([string]$dir = "input/chi480", [string]$tag = "chi480", [switch]$skipMulti)
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
$common = @("--lowvram", "--seed", "1", "--steps", "25", "--simplify", "0.88", "--texture", "2048")
$runs = @(
  @{ name = "single"; args = @() },
  @{ name = "hybrid"; args = @("--more", "$dir/front.png", "$dir/back.png", "--shape-from-first", "--mode", "multidiffusion") },
  @{ name = "multi";  args = @("--more", "$dir/front.png", "$dir/back.png", "--mode", "multidiffusion") }
)
foreach ($r in $runs) {
  if ($skipMulti -and $r.name -eq "multi") { continue }
  $out = "output/${tag}_$($r.name).glb"
  Write-Host "$($r.name) start"
  docker run --rm --gpus all -e HF_HUB_OFFLINE=1 -e ATTN_BACKEND=sdpa -e SPARSE_ATTN_BACKEND=xformers `
    -v "${PSScriptRoot}:/work" -v "${PSScriptRoot}\models:/models" langlang-trellis `
    python /work/make3d.py "$dir/side.png" $out @($r.args) @common *> "${tag}_$($r.name).log"
  if ($LASTEXITCODE -eq 0 -and (Test-Path $out)) { Write-Host "$($r.name) OK" } else { Write-Host "$($r.name) FAILED" }
}
Write-Host "ALL_DONE"
