# 浪浪夥伴 3D 實驗：放一整晚，自動下載並建好 TRELLIS，最後試做阿福的 3D 模型。
# 用法：在這個資料夾按右鍵「在終端機開啟」，執行
#   powershell -ExecutionPolicy Bypass -File .\overnight.ps1
# 執行期間電腦不會自動睡眠（只在這個視窗開著時有效，關掉就恢復），請插著電源。
# 所有進度寫在 overnight.log。

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
$log = Join-Path $PSScriptRoot "overnight.log"
function Say($m) { $line = "[{0}] {1}" -f (Get-Date -Format "MM/dd HH:mm:ss"), $m; Write-Host $line; try { Add-Content -Path $log -Value $line -Encoding utf8 -ErrorAction Stop } catch {} }

# 執行期間不讓電腦睡眠（不改系統設定，視窗關掉就失效）
Add-Type -Namespace Win32 -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
[Win32.Power]::SetThreadExecutionState([uint32]2147483649) | Out-Null   # ES_CONTINUOUS | ES_SYSTEM_REQUIRED

function Ensure-Docker {
  docker info *> $null
  if ($LASTEXITCODE -eq 0) { return $true }
  Say "啟動 Docker Desktop…"
  Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  for ($i = 0; $i -lt 60; $i++) { Start-Sleep -Seconds 5; docker info *> $null; if ($LASTEXITCODE -eq 0) { return $true } }
  return $false
}

New-Item -ItemType Directory -Force -Path models, output | Out-Null

# 1. 建立環境（斷線就重試，已下載的部分會保留）
$built = $false
if (Ensure-Docker) { docker image inspect langlang-trellis *> $null; if ($LASTEXITCODE -eq 0) { $built = $true; Say "環境已建好，跳過建立" } }
for ($try = 1; $try -le 30 -and -not $built; $try++) {
  if (-not (Ensure-Docker)) { Say "Docker 沒有啟動，60 秒後重試"; Start-Sleep 60; continue }
  Say "第 $try 次建立環境（下載 CUDA、PyTorch、編譯元件）…"
  docker build --progress=plain -t langlang-trellis . *>> build.log
  if ($LASTEXITCODE -eq 0) { $built = $true; Say "環境建立完成" } else { Say "建立失敗，2 分鐘後重試（詳情看 build.log 最後幾行）"; Start-Sleep 120 }
}
if (-not $built) { Say "環境一直建不起來，請把 build.log 給 Claude 看"; exit 1 }

# 2. 預先下載模型（TRELLIS 約 3 GB、DINOv2 約 1 GB），存在 models 資料夾，之後不用再下載
$got = $false
for ($try = 1; $try -le 30 -and -not $got; $try++) {
  if (-not (Ensure-Docker)) { Start-Sleep 60; continue }
  Say "第 $try 次下載模型…"
  docker run --rm -v "${PSScriptRoot}:/work" -v "${PSScriptRoot}\models:/models" langlang-trellis python /work/fetch_models.py *>> models.log
  if ($LASTEXITCODE -eq 0) { $got = $true; Say "模型下載完成" } else { Say "下載中斷，1 分鐘後接著下載"; Start-Sleep 60 }
}
if (-not $got) { Say "模型一直下載失敗，請把 models.log 給 Claude 看"; exit 1 }

# 3. 試做阿福（8 GB 顯示卡用省記憶體模式）
Say "開始試做阿福的 3D 模型…"
docker run --rm --gpus all -v "${PSScriptRoot}:/work" -v "${PSScriptRoot}\models:/models" langlang-trellis `
  python /work/make3d.py input/afu.png output/afu.glb --lowvram *>> make3d.log
if ($LASTEXITCODE -eq 0 -and (Test-Path output\afu.glb)) { Say "完成！output\afu.glb 已產生，明天跟 Claude 說「好了」。" }
else { Say "試做失敗，請跟 Claude 說，Claude 會看 make3d.log 找原因。" }

[Win32.Power]::SetThreadExecutionState([uint32]2147483648) | Out-Null
