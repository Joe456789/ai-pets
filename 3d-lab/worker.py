"""「從此有你」3D 紀念工作站：在這台有顯示卡的電腦上，向網站領任務，用 TRELLIS 把照片做成 3D 模型，再傳回去。

用法（在 3d-lab 資料夾）：
  python worker.py          一直執行，每 30 秒看有沒有新任務（Ctrl+C 結束）
  python worker.py --once   只處理一個任務就結束（測試用）

設定放在同資料夾的 worker.env（不要放進版本控制）：
  SERVER=https://你的網站網址
  WORKER_TOKEN=和網站 Cloud Run 上設定的 WORKER_TOKEN 相同

第一次處理沒有去背的照片時，TRELLIS 會自動下載去背模型（rembg 的 u2net，約 170 MB）到 models/u2net。
"""
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
JOBS = HERE / "jobs"
IMAGE = "langlang-trellis"


def load_env():
    env = {}
    # --prod：連正式站，讀 worker.prod.env；平常（本機測試站）讀 worker.env
    f = HERE / ("worker.prod.env" if "--prod" in sys.argv else "worker.env")
    if f.exists():
        for line in f.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    server = (os.environ.get("SERVER") or env.get("SERVER", "")).rstrip("/")
    token = os.environ.get("WORKER_TOKEN") or env.get("WORKER_TOKEN", "")
    if not server or not token:
        sys.exit("請先在 worker.env 設定 SERVER 和 WORKER_TOKEN")
    return server, token


def call(server, token, method, path, data=None, ctype="application/json"):
    req = urllib.request.Request(f"{server}{path}", data=data, method=method, headers={"Authorization": f"Bearer {token}", "Content-Type": ctype})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.status, r.read()


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def ensure_docker():
    if subprocess.run(["docker", "info"], capture_output=True).returncode == 0:
        return
    log("啟動 Docker Desktop…")
    subprocess.Popen([r"C:\Program Files\Docker\Docker\Docker Desktop.exe"])
    for _ in range(60):
        time.sleep(5)
        if subprocess.run(["docker", "info"], capture_output=True).returncode == 0:
            return
    raise RuntimeError("Docker 沒有啟動")


def make_model(job_dir: Path, n: int) -> Path:
    rel = job_dir.relative_to(HERE).as_posix()
    photos = [f"{rel}/p{i}.jpg" for i in range(n)]
    raw = f"{rel}/raw.glb"
    args = ["python", "/work/make3d.py", photos[0], raw, "--lowvram", "--seed", "1", "--steps", "25", "--simplify", "0.85", "--texture", "2048"]
    if n > 1:
        # 影片測試的結論：形狀只看第一張（側面全身），其他角度只用來補臉和毛色
        args += ["--more", *photos[1:], "--shape-from-first", "--mode", "multidiffusion"]
    cmd = ["docker", "run", "--rm", "--gpus", "all", "-e", "HF_HUB_OFFLINE=1", "-e", "ATTN_BACKEND=sdpa", "-e", "SPARSE_ATTN_BACKEND=xformers",
           "-v", f"{HERE}:/work", "-v", f"{HERE / 'models'}:/models", IMAGE, *args]
    with open(job_dir / "make3d.log", "w", encoding="utf-8") as lf:
        r = subprocess.run(cmd, stdout=lf, stderr=subprocess.STDOUT)
    if r.returncode != 0 or not (HERE / raw).exists():
        raise RuntimeError("3D 重建失敗，請換一張站著、看得到全身的側面照再試一次")
    final = job_dir / "final.glb"
    r = subprocess.run([sys.executable, str(HERE / "fix_glb.py"), str(HERE / raw), str(final)], capture_output=True,
                       encoding="utf-8", errors="replace", env={**os.environ, "PYTHONUTF8": "1"})
    if r.returncode != 0 or not final.exists():
        raise RuntimeError("模型整理失敗")
    return final


def run_one(server, token) -> bool:
    status, body = call(server, token, "POST", "/api/worker/next", b"{}")
    if status == 204:
        return False
    job = json.loads(body)
    jid, n = job["id"], int(job["photos"])
    log(f"新任務 {jid}：{n} 張照片")
    job_dir = JOBS / jid
    shutil.rmtree(job_dir, ignore_errors=True)
    job_dir.mkdir(parents=True)
    try:
        for i in range(n):
            _, img = call(server, token, "GET", f"/api/worker/photo?id={jid}&i={i}")
            (job_dir / f"p{i}.jpg").write_bytes(img)
        ensure_docker()
        t0 = time.time()
        final = make_model(job_dir, n)
        call(server, token, "POST", f"/api/worker/done?id={jid}", final.read_bytes(), "model/gltf-binary")
        log(f"完成 {jid}，花了 {time.time() - t0:.0f} 秒，已上傳並通知飼主")
        shutil.rmtree(job_dir, ignore_errors=True)  # 照片是私人資料，做完就刪
    except Exception as e:  # noqa: BLE001
        msg = str(e) if any("\u4e00" <= ch <= "\u9fff" for ch in str(e)) else "製作時發生錯誤，請稍後再試"
        log(f"失敗 {jid}：{e}（記錄留在 {job_dir / 'make3d.log'}）")
        for p in job_dir.glob("p*.jpg"):
            p.unlink(missing_ok=True)  # 照片是私人資料，失敗也不留
        try:
            call(server, token, "POST", f"/api/worker/fail?id={jid}", json.dumps({"error": msg}).encode())
        except urllib.error.URLError:
            pass
    return True


def main():
    server, token = load_env()
    once = "--once" in sys.argv
    log(f"工作站啟動，連到 {server}")
    while True:
        try:
            got = run_one(server, token)
        except urllib.error.HTTPError as e:
            log(f"網站回應 {e.code}，{'請確認 WORKER_TOKEN' if e.code == 401 else '稍後再試'}")
            got = False
        except urllib.error.URLError as e:
            log(f"連不到網站：{e.reason}")
            got = False
        if once:
            break
        if not got:
            time.sleep(30)


if __name__ == "__main__":
    main()
