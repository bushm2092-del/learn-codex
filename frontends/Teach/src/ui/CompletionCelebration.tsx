import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import "./CompletionCelebration.css";

// 仅在服务端确认新打卡后挂载；Portal 避免被章节容器裁切，不接管焦点。
export function CompletionCelebration({ message, onFinish }: { message: string; onFinish: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onFinish, 2600);
    const dismiss = (event: KeyboardEvent) => { if (event.key === "Escape") onFinish(); };
    window.addEventListener("keydown", dismiss);
    return () => { window.clearTimeout(timer); window.removeEventListener("keydown", dismiss); };
  }, [onFinish]);
  return createPortal(<div className="completion-celebration">
    <div className="completion-celebration__paper" aria-hidden="true">
      {Array.from({ length: 64 }, (_, i) => <i key={i} style={{
        "--x": `${(i * 37) % 100}vw`, "--drift": `${((i * 23) % 160) - 80}px`,
        "--delay": `${(i % 8) * 45}ms`, "--spin": `${(i % 2 ? 1 : -1) * (180 + i * 17)}deg`,
        "--paper": ["#3b82f6", "#111113", "#d7a32b", "#71717a"][i % 4],
      } as CSSProperties} />)}
    </div>
    <div className="completion-celebration__message" role="status">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>{message}
    </div>
  </div>, document.body);
}
