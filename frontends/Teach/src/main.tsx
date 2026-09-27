import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { router } from "./app/router";
import { LocaleProvider } from "./i18n/LocaleProvider";
import { AuthProvider } from "./auth/AuthProvider";
import "./styles/global.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("找不到 #root 挂载节点");
}

createRoot(root).render(
  <StrictMode>
    <LocaleProvider>
      <AuthProvider><RouterProvider router={router} /></AuthProvider>
    </LocaleProvider>
  </StrictMode>,
);
