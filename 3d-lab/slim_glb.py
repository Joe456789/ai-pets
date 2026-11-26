"""把 TRELLIS.2 做出來的 GLB 改成手機友善的格式：
- 顏色貼圖從 webp 改成 JPEG（iPhone 的 AR 快速查看讀不了 webp）
- 拿掉金屬/粗糙度貼圖（我們用不打光的方式畫，AR 裡改成不反光的毛）
減面另外用 gltf-transform simplify。

用法：python slim_glb.py in.glb out.glb [貼圖邊長，預設 2048]
"""
import io
import sys

from PIL import Image

from fix_glb import read_glb, write_glb


def main(src, dst, size=2048):
    j, bin_ = read_glb(src)
    views = [bytes(bin_[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]]) for v in j["bufferViews"]]
    mat = j["materials"][0]
    pbr = mat["pbrMetallicRoughness"]
    base_tex = j["textures"][pbr["baseColorTexture"]["index"]]
    src_img = base_tex.get("source", base_tex.get("extensions", {}).get("EXT_texture_webp", {}).get("source"))
    img = j["images"][src_img]
    im = Image.open(io.BytesIO(views[img["bufferView"]])).convert("RGB")
    if max(im.size) > size:
        im = im.resize((size, size), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=88)
    views[img["bufferView"]] = buf.getvalue()
    img["mimeType"] = "image/jpeg"

    # 只留顏色貼圖
    pbr.pop("metallicRoughnessTexture", None)
    pbr["metallicFactor"] = 0.0
    pbr["roughnessFactor"] = 0.9
    j["images"] = [img]
    j["textures"] = [{"source": 0, **({"sampler": base_tex["sampler"]} if "sampler" in base_tex else {})}]
    pbr["baseColorTexture"] = {"index": 0}
    for k in ("extensionsUsed", "extensionsRequired"):
        j[k] = [e for e in j.get(k, []) if e != "EXT_texture_webp"]
        if not j[k]:
            j.pop(k)

    # 拿掉沒人用的 bufferView（舊的金屬/粗糙度貼圖），重新編號
    used = {a["bufferView"] for a in j["accessors"] if "bufferView" in a} | {img["bufferView"]}
    keep = [i for i in range(len(views)) if i in used]
    remap = {old: new for new, old in enumerate(keep)}
    j["bufferViews"] = [j["bufferViews"][i] for i in keep]
    views = [views[i] for i in keep]
    for a in j["accessors"]:
        if "bufferView" in a:
            a["bufferView"] = remap[a["bufferView"]]
    img["bufferView"] = remap[img["bufferView"]]
    total = write_glb(dst, j, views)
    print(f"{dst}: {total // 1024} KB, 貼圖 {im.size}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 2048)
