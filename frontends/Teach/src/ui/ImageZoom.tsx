import { useId, useRef } from "react";

import "./ImageZoom.css";

// 图片放大组件：按钮触发，原生 <dialog> 承担模态焦点、Escape 关闭与焦点归还；外观全部由 ImageZoom.css 定义。
export function ImageZoom({
  src,
  alt,
  width,
  height,
  zoomLabel,
  zoomHint,
  closeLabel,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  zoomLabel: string;
  zoomHint: string;
  closeLabel: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return <>
    <button
      type="button"
      className="ui-image-zoom__trigger"
      aria-label={zoomLabel}
      onClick={() => dialogRef.current?.showModal()}
    >
      <img src={src} alt={alt} width={width} height={height} loading="lazy" />
      <span className="ui-image-zoom__hint" aria-hidden="true">
        <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3.25 3.25" /></svg>
        {zoomHint}
      </span>
    </button>
    <dialog
      ref={dialogRef}
      className="ui-image-zoom"
      aria-labelledby={titleId}
      onClick={event => { if (event.target === dialogRef.current) dialogRef.current.close(); }}
    >
      <div className="ui-image-zoom__bar">
        <p className="ui-image-zoom__title" id={titleId}>{alt}</p>
        <button type="button" className="ui-image-zoom__close" aria-label={closeLabel} onClick={() => dialogRef.current?.close()}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" /></svg>
        </button>
      </div>
      <div className="ui-image-zoom__stage">
        <img src={src} alt="" />
      </div>
    </dialog>
  </>;
}
