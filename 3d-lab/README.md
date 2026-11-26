# 從此有你：3D 紀念工作站

「紀念與告別」功能的 3D 重建工作站。在有 NVIDIA 顯示卡的電腦上，用 [Microsoft TRELLIS](https://github.com/microsoft/TRELLIS) 把飼主上傳的照片做成 3D 模型（GLB），再傳回網站。網站程式在 [cong-ci-you-ni](https://github.com/Joe456789/cong-ci-you-ni)。

## 檔案

- `Dockerfile`、`Dockerfile.patch`：建立 TRELLIS 執行環境（CUDA 12.8、PyTorch 2.7，支援 RTX 50 系列）
- `fetch_models.py`：預先下載 TRELLIS 和 DINOv2 模型
- `make3d.py`：把去背照片做成 GLB，支援 8 GB 顯示卡；可加入多個角度（`--more`、`--shape-from-first`）
- `fix_glb.py`：整理 GLB：修掉貼圖上的綠色色塊，並把貼圖存成 JPEG 讓檔案變小
- `cutout.py`：從影片畫面把動物去背成透明 PNG（OpenCV GrabCut）
- `worker.py`：向網站領任務、產生模型、上傳結果
- `overnight.ps1`、`regen.ps1`、`compare.ps1`：建置和比較用的腳本
- `preview.html`、`compare.html`：在瀏覽器檢視產出的模型

## 設定

`worker.py` 讀同資料夾的 `worker.env`（不在版本控制裡）：

```
SERVER=https://你的網站網址
WORKER_TOKEN=和網站上設定的 WORKER_TOKEN 相同
```

模型權重、照片、影片和產出的模型都沒有放進這個儲存庫。
