import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api/client";
import { lessons } from "../course/catalog";
export function PageViews() {
  const location = useLocation(); const previous = useRef("");
  useEffect(() => {
    const page = location.pathname;
    if (previous.current === page) return;
    previous.current = page;
    if (page !== "/" && !lessons.some((lesson) => lesson.path === page && lesson.status !== "planned")) return;
    // 不重试写统计；StrictMode 重执行及 hash 跳转不重复计数。
    void api("/analytics/views", { method: "POST", body: JSON.stringify({ page }) }).then(() => window.dispatchEvent(new Event("learn-view-recorded"))).catch(() => {});
  }, [location.pathname]);
  return null;
}
