import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { router } from "./app/router";
import { LocaleProvider } from "./i18n/LocaleProvider";
import "./styles/global.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("找不到 #root 挂载节点");
}

createRoot(root).render(
  <StrictMode>
    <LocaleProvider>
      <RouterProvider router={router} />
    </LocaleProvider>
  </StrictMode>,
);
