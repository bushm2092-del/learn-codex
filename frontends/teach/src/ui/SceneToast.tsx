import type { CSSProperties } from "react";
import "./SceneToast.css";

// 由场景传入可见度，不使用独立定时器，保证暂停和回拖一致。
export function SceneToast({ message, style }: { message: string; style?: CSSProperties }) {
  return <div className="scene-toast" role="status" style={style}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8"/></svg>{message}</div>;
}
