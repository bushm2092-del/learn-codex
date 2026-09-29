import type { CSSProperties, PropsWithChildren } from "react";
import "./FocusPanel.css";

interface FocusPanelProps extends PropsWithChildren {
  active: boolean;
  label: string;
  focusLabel: string;
  className?: string;
  style?: CSSProperties;
}

// 只提供教学焦点样式，不依赖具体课程、时间线或语言状态。
export function FocusPanel({ active, label, focusLabel, className = "", style, children }: FocusPanelProps) {
  return (
    <section className={`focus-panel ${className}`} data-active={active} aria-label={label} style={style}>
      <div className="focus-panel__label">
        <span>{label}</span>
        {active && <strong>{focusLabel}</strong>}
      </div>
      {children}
    </section>
  );
}
