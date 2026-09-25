import { createBrowserRouter, Navigate } from "react-router-dom";

import { CourseHomePage } from "../course/CourseHomePage";
import { HarnessOverviewPage } from "../lessons/harness-overview/HarnessOverviewPage";
import { AppShell } from "../ui/AppShell";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <CourseHomePage /> },
      { path: "lessons/harness-overview", element: <HarnessOverviewPage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
