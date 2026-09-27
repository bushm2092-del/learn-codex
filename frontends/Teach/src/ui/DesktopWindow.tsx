import type { CSSProperties, PropsWithChildren } from "react";
import "./DesktopWindow.css";

interface DesktopWindowProps extends PropsWithChildren {
  title: string;
  className?: string;
  style?: CSSProperties;
}
// 纯展示外壳：不包含课程、语言或播放状态。
export function DesktopWindow({ title, className = "", style, children }: DesktopWindowProps) {
  return <section className={`desktop-window ${className}`} style={style} aria-label={title}>
    <header className="desktop-window__titlebar"><span className="desktop-window__lights" aria-hidden="true"><i/><i/><i/></span>{title}</header>
    {children}
  </section>;
}
