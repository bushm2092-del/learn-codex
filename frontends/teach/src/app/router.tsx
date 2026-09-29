import { createBrowserRouter, Navigate } from "react-router-dom";

import { CourseHomePage } from "../course/CourseHomePage";
import { AppShell } from "../ui/AppShell";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { path: "login", lazy: async () => ({ Component: (await import("../auth/LoginPage")).LoginPage }) },
      { index: true, element: <CourseHomePage /> },
      { path: "leaderboard", lazy: async () => ({ Component: (await import("../community/LeaderboardPage")).LeaderboardPage }) },
      { path: "lessons/agent-loop", lazy: async () => ({ Component: (await import("../lessons/agent-loop/AgentLoopPage")).AgentLoopPage }) },
      { path: "lessons/model-protocols", lazy: async () => ({ Component: (await import("../lessons/model-protocols/ModelProtocolsPage")).ModelProtocolsPage }) },
      { path: "lessons/function-call", lazy: async () => ({ Component: (await import("../lessons/function-call/FunctionCallingPage")).FunctionCallingPage }) },
      { path: "lessons/function-call-source", lazy: async () => ({ Component: (await import("../lessons/function-call-source/FunctionCallSourcePage")).FunctionCallSourcePage }) },
      { path: "lessons/harness-overview", element: <Navigate to="/lessons/agent-loop" replace /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
