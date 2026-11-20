import { notFound } from "next/navigation";
import { Pet3dLab } from "./Pet3dLab";

// 開發用：檢查 3D 模型的自動骨架與動作。正式環境不開放。
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Pet3dLab />;
}
