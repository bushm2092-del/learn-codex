import type { CSSProperties } from "react";
import "./SceneDialog.css";

// 动画中的展示弹窗，不是阻塞网页交互的真实模态框。
export function SceneDialog({ title, description, style }: { title: string; description: string; style?: CSSProperties }) {
  return <div className="scene-dialog" style={style}>
    <section className="scene-dialog__surface" aria-label={title}>
      <h3>{title}</h3>
      <p>{description}</p>
    </section>
  </div>;
}
