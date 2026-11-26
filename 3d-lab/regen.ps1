# 用較高品質重做 3D 模型：多試幾個隨機種子，之後挑最像照片的一個。
# 用法：powershell -ExecutionPolicy Bypass -File .\regen.ps1 afu 1,7,42
param([string]$name = "afu", [string]$seeds = "1,7,42", [int]$steps = 25, [double]$simplify = 0.85, [int]$texture = 2048)
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "start docker"
  Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  for ($i = 0; $i -lt 60; $i++) { Start-Sleep -Seconds 5; docker info *> $null; if ($LASTEXITCODE -eq 0) { break } }
}
docker info *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "DOCKER_FAILED"; exit 1 }

foreach ($s in $seeds.Split(",")) {
  $out = "output/${name}_s$s.glb"
  Write-Host "seed $s start"
  docker run --rm --gpus all -e HF_HUB_OFFLINE=1 -e ATTN_BACKEND=sdpa -e SPARSE_ATTN_BACKEND=xformers `
    -v "${PSScriptRoot}:/work" -v "${PSScriptRoot}\models:/models" langlang-trellis `
    python /work/make3d.py "input/$name.png" $out --lowvram --seed $s --steps $steps --simplify $simplify --texture $texture *> "regen_s$s.log"
  if ($LASTEXITCODE -eq 0 -and (Test-Path $out)) { Write-Host "seed $s OK $((Get-Item $out).Length)" } else { Write-Host "seed $s FAILED" }
}
Write-Host "ALL_DONE"
