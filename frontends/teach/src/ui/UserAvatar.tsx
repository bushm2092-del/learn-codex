import { useState } from "react";
import "./UserAvatar.css";

// 真实头像加载失败时回退到首字母；不把普通账号误标为 GitHub 账号。
export function UserAvatar({ name, src }: { name: string; src?: string }) {
  const [failedURL, setFailedURL] = useState<string>();
  return <span className="ui-avatar" aria-hidden="true">
    {src && src !== failedURL ? <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailedURL(src)} /> : name.slice(0, 1).toUpperCase()}
  </span>;
}
