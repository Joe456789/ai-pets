"""整理 TRELLIS 做出來的 GLB：把貼圖上不該有的綠色色塊改成毛色，並把貼圖存成 JPEG 讓檔案變小。

用法：python fix_glb.py output/afu_s1.glb output/afu_final.glb
"""
import io
import json
import struct
import sys

import numpy as np
from PIL import Image


def read_glb(path):
    b = open(path, "rb").read()
    jlen = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + jlen])
    bstart = 20 + jlen
    blen = struct.unpack("<I", b[bstart:bstart + 4])[0]
    return j, b[bstart + 8:bstart + 8 + blen]


def write_glb(path, j, views):
    """views：每個 bufferView 的位元組內容。重新排列並寫出。"""
    out = bytearray()
    for i, data in enumerate(views):
        while len(out) % 4:
            out.append(0)
        j["bufferViews"][i]["byteOffset"] = len(out)
        j["bufferViews"][i]["byteLength"] = len(data)
        out += data
    while len(out) % 4:
        out.append(0)
    j["buffers"] = [{"byteLength": len(out)}]
    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    total = 12 + 8 + len(js) + 8 + len(out)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<I4s", len(js), b"JSON") + js)
        f.write(struct.pack("<I4s", len(out), b"BIN\0") + bytes(out))
    return total


def degreen(img):
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # 德國牧羊犬的毛沒有綠色：綠色分量不比紅色低、又明顯高於藍色，就是做模型時多出來的雜色
    mask = (g >= r - 1) & (g > b + 6)
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    a[..., 0] = np.where(mask, np.clip(lum * 1.22, 0, 255), r)
    a[..., 1] = np.where(mask, np.clip(lum * 0.92, 0, 255), g)
    a[..., 2] = np.where(mask, np.clip(lum * 0.62, 0, 255), b)
    return Image.fromarray(a.astype(np.uint8)), int(mask.sum())


def main(src, dst):
    j, bin_ = read_glb(src)
    views = [bytes(bin_[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]]) for v in j["bufferViews"]]
    for im in j.get("images", []):
        i = im["bufferView"]
        fixed, n = degreen(Image.open(io.BytesIO(views[i])))
        buf = io.BytesIO()
        fixed.save(buf, "JPEG", quality=88, optimize=True)
        views[i] = buf.getvalue()
        im["mimeType"] = "image/jpeg"
        print(f"貼圖 {fixed.size}：修掉 {n} 個綠色像素，{len(views[i]) // 1024} KB")
    total = write_glb(dst, j, views)
    print(f"寫出 {dst}，{total // 1024} KB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
