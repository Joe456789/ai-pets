"""從影片畫面把動物去背成透明 PNG（OpenCV GrabCut，不用另外下載模型）。

用法：python cutout.py 畫面.png x0 y0 x1 y1 輸出.png
x0 y0 x1 y1 是動物大概的範圍（畫面上的像素）。
"""
import sys

import cv2
import numpy as np
from scipy import ndimage


def cutout(src, box, dst, pad=0.25, min_side=640):
    img = cv2.imread(src)
    h, w = img.shape[:2]
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    # 多留一圈背景，GrabCut 才知道什麼是背景
    cx0, cy0 = max(0, int(x0 - bw * pad)), max(0, int(y0 - bh * pad))
    cx1, cy1 = min(w, int(x1 + bw * pad)), min(h, int(y1 + bh * pad))
    crop = img[cy0:cy1, cx0:cx1]
    scale = max(1.0, min_side / max(crop.shape[:2]))
    if scale > 1:
        crop = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_LANCZOS4)
    rect = (int((x0 - cx0) * scale), int((y0 - cy0) * scale), int(bw * scale), int(bh * scale))
    mask = np.zeros(crop.shape[:2], np.uint8)
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(crop, mask, rect, bgd, fgd, 6, cv2.GC_INIT_WITH_RECT)
    fg = ((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)).astype(np.uint8)
    # 夾在腳中間的地板：顏色跟框外的背景很像的就去掉
    lab_img = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB).astype(np.float32)
    outside = np.ones(crop.shape[:2], bool)
    outside[rect[1]:rect[1] + rect[3], rect[0]:rect[0] + rect[2]] = False
    bg = lab_img[outside]
    med = np.median(bg, axis=0)
    near = bg[np.linalg.norm(bg - med, axis=1) < 40]  # 背景的主要顏色（忽略鞋子、看板等雜物）
    mean, cov = near.mean(axis=0), np.cov(near.T) + np.eye(3) * 4
    d = lab_img - mean
    maha = np.sqrt(np.einsum("...i,ij,...j->...", d, np.linalg.inv(cov), d))
    fg[maha < 3.2] = 0
    # 去掉細線（牽繩）和零碎的小塊，只留最大的一塊，再把中間的洞補起來
    k = max(3, int(round(min(crop.shape[:2]) * 0.012)) | 1)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    lab, n = ndimage.label(fg)
    if n == 0:
        raise SystemExit("去背失敗：找不到動物")
    sizes = ndimage.sum(fg, lab, range(1, n + 1))
    fg = (lab == (1 + int(np.argmax(sizes)))).astype(np.uint8)
    # 只補小洞（眼睛、鼻子），腳中間的大空隙要留著
    holes = ndimage.binary_fill_holes(fg) & (fg == 0)
    hl, hn = ndimage.label(holes)
    if hn:
        hs = ndimage.sum(holes, hl, range(1, hn + 1))
        for j, sz in enumerate(hs):
            if sz < fg.sum() * 0.02:
                fg[hl == j + 1] = 1
    alpha = cv2.GaussianBlur(fg.astype(np.float32) * 255, (0, 0), 1.2)
    rgba = np.dstack([cv2.cvtColor(crop, cv2.COLOR_BGR2RGB), alpha.astype(np.uint8)])
    ys, xs = np.where(fg > 0)
    m = 12
    rgba = rgba[max(0, ys.min() - m):ys.max() + m, max(0, xs.min() - m):xs.max() + m]
    cv2.imwrite(dst, cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA))
    print(f"{dst}: {rgba.shape[1]}x{rgba.shape[0]}，動物占 {fg.mean() * 100:.0f}% 的裁切範圍")


if __name__ == "__main__":
    cutout(sys.argv[1], [int(v) for v in sys.argv[2:6]], sys.argv[6])
