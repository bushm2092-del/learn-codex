import { createBrowserRouter, Navigate } from "react-router-dom";

import { CourseHomePage } from "../course/CourseHomePage";
import { AppShell } from "../ui/AppShell";

export const router = createBrowserRouter([
  {
    path: "/login",
    lazy: async () => ({ Component: (await import("../ui/LoginShell")).LoginShell }),
    children: [{ index: true, lazy: async () => ({ Component: (await import("../auth/LoginPage")).LoginPage }) }],
  },
  {
    path: "/talent",
    lazy: async () => ({ Component: (await import("../ui/TalentShell")).TalentShell }),
    children: [
      { index: true, lazy: async () => ({ Component: (await import("../talent/TalentHomePage")).TalentHomePage }) },
      { path: "leaderboard", lazy: async () => ({ Component: (await import("../talent/TalentLeaderboardPage")).TalentLeaderboardPage }) },
      { path: ":game", lazy: async () => ({ Component: (await import("../talent/TalentPage")).TalentPage }) },
    ],
  },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <CourseHomePage /> },
      { path: "leaderboard", lazy: async () => ({ Component: (await import("../community/LeaderboardPage")).LeaderboardPage }) },
      { path: "lessons/agent-loop", lazy: async () => ({ Component: (await import("../lessons/agent-loop/AgentLoopPage")).AgentLoopPage }) },
      { path: "lessons/model-protocols", lazy: async () => ({ Component: (await import("../lessons/model-protocols/ModelProtocolsPage")).ModelProtocolsPage }) },
      { path: "lessons/function-call", lazy: async () => ({ Component: (await import("../lessons/function-call/FunctionCallingPage")).FunctionCallingPage }) },
      { path: "lessons/function-call-source", lazy: async () => ({ Component: (await import("../lessons/function-call-source/FunctionCallSourcePage")).FunctionCallSourcePage }) },
      { path: "lessons/context", lazy: async () => ({ Component: (await import("../lessons/context/ContextPage")).ContextPage }) },
      { path: "lessons/harness-overview", element: <Navigate to="/lessons/agent-loop" replace /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
