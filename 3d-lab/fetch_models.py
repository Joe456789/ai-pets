"""預先下載 TRELLIS 與 DINOv2 模型到 /models（斷線重跑會接著下載）。"""
from huggingface_hub import snapshot_download
import torch

snapshot_download("microsoft/TRELLIS-image-large")
torch.hub.load("facebookresearch/dinov2", "dinov2_vitl14_reg", pretrained=True)
print("ok", flush=True)
