import { createBrowserRouter, Navigate } from "react-router-dom";

import { CourseHomePage } from "../course/CourseHomePage";
import { AppShell } from "../ui/AppShell";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <CourseHomePage /> },
      { path: "lessons/agent-loop", lazy: async () => ({ Component: (await import("../lessons/agent-loop/AgentLoopPage")).AgentLoopPage }) },
      { path: "lessons/harness-overview", element: <Navigate to="/lessons/agent-loop" replace /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
