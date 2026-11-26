# 浪浪夥伴：在本機用 Microsoft TRELLIS 把動物去背照片做成 3D 模型（GLB）。
# 只用官方來源：NVIDIA CUDA 映像、PyTorch 官方套件、各專案的 GitHub 原始碼。
# RTX 50 系列（Blackwell，sm_120）需要 CUDA 12.8 與 PyTorch 2.7 以上。
FROM nvidia/cuda:12.8.1-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_NO_CACHE_DIR=1 \
    TORCH_CUDA_ARCH_LIST="12.0" \
    MAX_JOBS=4 \
    ATTN_BACKEND=xformers \
    SPCONV_ALGO=native \
    HF_HOME=/models/hf \
    TORCH_HOME=/models/torch \
    U2NET_HOME=/models/u2net

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3.10 python3.10-dev python3-pip git ninja-build build-essential \
      libgl1 libglib2.0-0 libegl1 libgles2 libglvnd-dev libjpeg-dev \
    && ln -sf /usr/bin/python3.10 /usr/bin/python && rm -rf /var/lib/apt/lists/*

RUN python -m pip install --upgrade pip setuptools wheel
RUN pip install torch==2.7.1 torchvision==0.22.1 --index-url https://download.pytorch.org/whl/cu128
RUN pip install xformers==0.0.31.post1 --index-url https://download.pytorch.org/whl/cu128

RUN pip install pillow imageio imageio-ffmpeg tqdm easydict opencv-python-headless scipy ninja \
      trimesh xatlas pyvista pymeshfix igraph "transformers<4.50" safetensors huggingface_hub "numpy<2" \
      plyfile open3d rembg onnxruntime \
    && pip install git+https://github.com/EasternJournalist/utils3d.git@9a4eb15e4021b67b12c460c7057d642626897ec8

# 稀疏卷積
RUN pip install spconv-cu126

WORKDIR /src
# 可微分網格光柵化（貼圖烘焙用）
RUN git clone https://github.com/NVlabs/nvdiffrast.git && pip install --no-build-isolation ./nvdiffrast
# 3D 高斯光柵化（把高斯渲染成貼圖用）
RUN git clone https://github.com/autonomousvision/mip-splatting.git \
    && pip install --no-build-isolation ./mip-splatting/submodules/diff-gaussian-rasterization/
# TRELLIS 本體
RUN git clone --recurse-submodules https://github.com/microsoft/TRELLIS.git
# Kaolin（FlexiCubes 取網格用）
RUN pip install kaolin==0.18.0 -f https://nvidia-kaolin.s3.us-east-2.amazonaws.com/torch-2.7.1_cu128.html || \
    pip install --no-build-isolation git+https://github.com/NVIDIAGameWorks/kaolin.git@v0.18.0

ENV PYTHONPATH=/src/TRELLIS
WORKDIR /work
