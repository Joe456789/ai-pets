"use client";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { analyzeRig, normalizeRig, type RigInfo } from "@/lib/petRig";
import { BONES, PARENT, buildSkeleton, newSolved, solvePose, type Frame, type Skel } from "@/lib/petSkeleton";

export type PetModel = {
  mesh: THREE.SkinnedMesh;
  rig: RigInfo;
  skel: Skel;
  /** 套用一格的姿勢 */
  update: (f: Frame) => void;
  /** 嘴巴現在在世界座標的哪裡（叼球用） */
  mouth: (out: THREE.Vector3) => THREE.Vector3;
  dispose: () => void;
};

/**
 * 每個點的 x,y,z 依序排好。不能直接拿 attribute.array：
 * 減面工具（gltf-transform）會把位置、UV 交錯存在同一塊，array 會是整包混在一起的資料。
 */
function positionsOf(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute("position");
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { arr[i * 3] = pos.getX(i); arr[i * 3 + 1] = pos.getY(i); arr[i * 3 + 2] = pos.getZ(i); }
  return arr;
}

/** 讀進 GLB、放正、自動建立骨架和蒙皮，回傳可以擺姿勢的模型（身高 1、頭朝 +X、腳底 y=0）。 */
export async function loadPetModel(url: string): Promise<PetModel> {
  const gltf = await new GLTFLoader().loadAsync(url);
  let src: THREE.Mesh | null = null;
  gltf.scene.traverse((o) => { if (!src && (o as THREE.Mesh).isMesh) src = o as THREE.Mesh; });
  if (!src) throw new Error("模型裡沒有網格");
  const found = src as THREE.Mesh;
  found.updateWorldMatrix(true, false);
  const geo = (found.geometry as THREE.BufferGeometry).clone().applyMatrix4(found.matrixWorld);
  const arr = positionsOf(geo);
  const { flipped } = normalizeRig(arr);
  geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  geo.deleteAttribute("normal");
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  const rig = analyzeRig(arr, flipped);
  const skel = buildSkeleton(arr, rig, geo.index ? (geo.index.array as ArrayLike<number>) : null);
  geo.setAttribute("skinIndex", new THREE.BufferAttribute(skel.skinIndex, 4));
  geo.setAttribute("skinWeight", new THREE.BufferAttribute(skel.skinWeight, 4));

  const old = found.material as THREE.MeshStandardMaterial;
  // 貼圖是從照片來的，本身已經有光影；不再另外打光，顏色才會跟原本的照片一樣
  const mat = new THREE.MeshBasicMaterial({ map: old.map ?? null });
  if (mat.map) { mat.map.colorSpace = THREE.SRGBColorSpace; mat.map.anisotropy = 8; }

  // 骨頭：站姿時都不旋轉，只有位置
  const bones = BONES.map((name) => { const b = new THREE.Bone(); b.name = name; return b; });
  bones.forEach((b, i) => {
    const parent = PARENT[i];
    if (parent >= 0) { bones[parent].add(b); b.position.copy(skel.rest[i]).sub(skel.rest[parent]); } else b.position.copy(skel.rest[i]);
  });
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.add(bones[0]);
  bones[0].updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.frustumCulled = false; // 變形後的範圍跟原本不同，不要被誤判看不到

  const solved = newSolved();
  const inv = new THREE.Quaternion();
  const head = BONES.indexOf("head");
  return {
    mesh,
    rig,
    skel,
    update: (f) => {
      solvePose(skel, f, solved);
      bones[0].position.copy(solved.pos[0]);
      bones[0].quaternion.copy(solved.q[0]);
      for (let i = 1; i < bones.length; i++) bones[i].quaternion.copy(inv.copy(solved.q[PARENT[i]]).invert()).multiply(solved.q[i]);
    },
    mouth: (out) => out.copy(skel.mouth).sub(skel.rest[head]).applyMatrix4(bones[head].matrixWorld),
    dispose: () => { mesh.skeleton.dispose(); geo.dispose(); mat.map?.dispose(); mat.dispose(); },
  };
}

/**
 * 給手機內建 AR（iPhone 快速查看、Android Scene Viewer）用的真實大小模型：
 * 腳底在地板、高度＝heightM 公尺、側面朝向使用者（頭朝右）。回傳 GLB 檔內容。
 * iPhone 需要的 USDZ 由 model-viewer 從這個 GLB 自動轉出。
 */
export async function realSizeGlb(url: string, heightM: number): Promise<ArrayBuffer> {
  const [{ GLTFExporter }, gltf] = await Promise.all([
    import("three/addons/exporters/GLTFExporter.js"),
    new GLTFLoader().loadAsync(url),
  ]);
  let src: THREE.Mesh | null = null;
  gltf.scene.traverse((o) => { if (!src && (o as THREE.Mesh).isMesh) src = o as THREE.Mesh; });
  if (!src) throw new Error("模型裡沒有網格");
  const found = src as THREE.Mesh;
  found.updateWorldMatrix(true, false);
  const geo = (found.geometry as THREE.BufferGeometry).clone().applyMatrix4(found.matrixWorld);
  const arr = positionsOf(geo);
  normalizeRig(arr);
  for (let i = 0; i < arr.length; i++) arr[i] *= heightM;
  geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  geo.deleteAttribute("normal");
  geo.computeVertexNormals();
  const old = found.material as THREE.MeshStandardMaterial;
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: old.map ?? null, roughness: 0.9, metalness: 0 }));
  const scene = new THREE.Scene();
  scene.add(mesh);
  const out = await new GLTFExporter().parseAsync(scene, { binary: true });
  return out as ArrayBuffer;
}
