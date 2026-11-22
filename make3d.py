"""把一張去背的動物照片做成 3D 模型（GLB）。

用法（在容器內）：python /work/make3d.py input/afu.png output/afu.glb [--seed 1] [--steps 12]
8 GB 顯示卡：各個子模型平常放在記憶體，用到時才搬到顯示卡，用完就搬回來。
"""
import argparse
import gc
import os
import time

os.environ.setdefault("ATTN_BACKEND", "sdpa")            # 一般注意力用 PyTorch 內建
os.environ.setdefault("SPARSE_ATTN_BACKEND", "xformers")  # 稀疏注意力只支援 xformers

import torch
from PIL import Image

# RTX 50（sm_120）不能跑 xformers 自動挑的 Hopper 專用核心（FlashAttention 3），固定用 CUTLASS 核心
import xformers.ops as xops
_mea = xops.memory_efficient_attention
xops.memory_efficient_attention = lambda q, k, v, attn_bias=None, **kw: _mea(
    q, k, v, attn_bias, op=kw.pop("op", None) or xops.MemoryEfficientAttentionCutlassOp, **kw)

from trellis.pipelines import TrellisImageTo3DPipeline
from trellis.utils import postprocessing_utils


def log(msg: str):
    used = torch.cuda.max_memory_allocated() / 2**30 if torch.cuda.is_available() else 0
    print(f"[{time.strftime('%H:%M:%S')}] {msg}（顯示記憶體峰值 {used:.1f} GB）", flush=True)


class Offload:
    """讓 pipeline 的每個子模型只在被呼叫時才放到 GPU。"""

    def __init__(self, pipeline):
        self.p = pipeline
        for name, model in pipeline.models.items():
            model.to("cpu")
            model.forward = self.wrap(name, model, model.forward)  # 含 DINOv2（image_cond_model）

    @staticmethod
    def wrap(name, model, fwd):
        def run(*a, **k):
            moved = next(model.parameters()).device.type != "cuda"
            if moved:
                model.to("cuda")
            try:
                return fwd(*a, **k)
            finally:
                if moved:
                    model.to("cpu")
                    torch.cuda.empty_cache()
        return run


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--steps", type=int, default=12)
    ap.add_argument("--texture", type=int, default=1024)
    ap.add_argument("--simplify", type=float, default=0.95)
    ap.add_argument("--lowvram", action="store_true")
    # 同一隻動物其他角度的照片（從影片挑出來的正面、背面、另一側），讓看不到的那幾面不用靠猜
    ap.add_argument("--more", nargs="*", default=[])
    ap.add_argument("--mode", default="stochastic", choices=["stochastic", "multidiffusion"])
    # 形狀只看第一張（通常是站好的側面），其他角度只用來補臉和毛色；各張姿勢不同時比較穩
    ap.add_argument("--shape-from-first", action="store_true")
    a = ap.parse_args()

    t0 = time.time()
    pipe = TrellisImageTo3DPipeline.from_pretrained("microsoft/TRELLIS-image-large")
    if a.lowvram:
        Offload(pipe)
        type(pipe).device = property(lambda self: torch.device("cuda"))
    else:
        pipe.cuda()
    log("模型載入完成")

    images = [Image.open(f) for f in [a.src, *a.more]]
    params = dict(
        seed=a.seed,
        formats=["gaussian", "mesh"],
        sparse_structure_sampler_params={"steps": a.steps, "cfg_strength": 7.5},
        slat_sampler_params={"steps": a.steps, "cfg_strength": 3},
    )
    with torch.no_grad():
        if len(images) > 1 and a.shape_from_first:
            log(f"形狀用第 1 張，外觀用 {len(images)} 個角度")
            pre = [pipe.preprocess_image(i) for i in images]
            torch.manual_seed(a.seed)
            coords = pipe.sample_sparse_structure(pipe.get_cond(pre[:1]), 1, params["sparse_structure_sampler_params"])
            cond = pipe.get_cond(pre)
            cond["neg_cond"] = cond["neg_cond"][:1]
            with pipe.inject_sampler_multi_image("slat_sampler", len(pre), a.steps, mode=a.mode):
                slat = pipe.sample_slat(cond, coords, params["slat_sampler_params"])
            out = pipe.decode_slat(slat, params["formats"])
        elif len(images) > 1:
            log(f"用 {len(images)} 個角度的照片一起做")
            out = pipe.run_multi_image(images, mode=a.mode, **params)
        else:
            out = pipe.run(images[0], **params)
    log("3D 結構產生完成")
    del pipe
    gc.collect()
    torch.cuda.empty_cache()

    glb = postprocessing_utils.to_glb(out["gaussian"][0], out["mesh"][0], simplify=a.simplify, texture_size=a.texture)
    os.makedirs(os.path.dirname(a.dst) or ".", exist_ok=True)
    glb.export(a.dst)
    log(f"完成：{a.dst}，共 {time.time() - t0:.0f} 秒")


if __name__ == "__main__":
    main()
