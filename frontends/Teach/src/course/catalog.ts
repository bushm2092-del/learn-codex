import type { LessonDefinition } from "./types";

// 尚未开放的章节只展示目录，不开放尚未实现的路由。
export const lessons: readonly LessonDefinition[] = [
  {
    "id": "agent-loop",
    "order": 1,
    "path": "/lessons/agent-loop",
    "title": {
      "zh": "Agent Loop · 执行循环",
      "en": "Agent Loop"
    },
    "description": {
      "zh": "输入、模型响应、工具执行与下一轮循环。",
      "en": "Input, model responses, tool execution, and the next iteration."
    },
    "status": "ready"
  },
  {
    "id": "model-protocols",
    "available": true,
    "order": 2,
    "path": "/lessons/model-protocols",
    "title": {
      "zh": "Responses / Chat · 模型协议",
      "en": "Responses / Chat Protocols"
    },
    "description": {
      "zh": "一切基于 HTTP 请求：Agent 能有什么能力，完全取决于请求参数提供了什么。",
      "en": "Everything runs through HTTP requests: what an agent can do depends entirely on what the request parameters provide."
    },
    "status": "ready"
  },
  {
    "id": "function-call",
    "available": false,
    "order": 3,
    "path": "/lessons/function-call",
    "title": {
      "zh": "Function Calling · 工具调用",
      "en": "Function Calling"
    },
    "description": {
      "zh": "工具定义、参数生成、调用调度和结果回传。",
      "en": "Tool definitions, arguments, dispatch, and result delivery."
    },
    "status": "draft"
  },
  {
    "id": "context",
    "order": 4,
    "path": "/lessons/context",
    "title": {
      "zh": "Context · 上下文机制",
      "en": "Context · Context Management"
    },
    "description": {
      "zh": "上下文组成、历史消息、窗口限制与压缩机制。",
      "en": "Context composition, message history, window limits, and compaction."
    },
    "status": "planned"
  },
  {
    "id": "session-storage",
    "order": 5,
    "path": "/lessons/session-storage",
    "title": {
      "zh": "Session · 会话存储机制",
      "en": "Session · Session Storage"
    },
    "description": {
      "zh": "会话记录如何持久化，以及如何加载和恢复。",
      "en": "How session records are persisted, loaded, and resumed."
    },
    "status": "planned"
  },
  {
    "id": "mcp",
    "order": 6,
    "path": "/lessons/mcp",
    "title": {
      "zh": "MCP · 外部工具接入",
      "en": "MCP · External Tools"
    },
    "description": {
      "zh": "工具发现、连接与调用，以及与 Function Calling 的关系。",
      "en": "Tool discovery, connections, invocation, and the relationship to function calling."
    },
    "status": "planned"
  },
  {
    "id": "skills",
    "order": 7,
    "path": "/lessons/skills",
    "title": {
      "zh": "Skills · 可复用工作流",
      "en": "Skills · Reusable Workflows"
    },
    "description": {
      "zh": "技能发现、按需加载，以及指令和工具的配合。",
      "en": "Skill discovery, on-demand loading, and coordination between instructions and tools."
    },
    "status": "planned"
  },
  {
    "id": "sandbox",
    "order": 8,
    "path": "/lessons/sandbox",
    "title": {
      "zh": "Sandbox · 沙箱与权限",
      "en": "Sandbox · Permissions"
    },
    "description": {
      "zh": "执行隔离、文件和网络权限、审批机制。",
      "en": "Execution isolation, filesystem and network permissions, and approvals."
    },
    "status": "planned"
  },
  {
    "id": "plan-mode",
    "order": 9,
    "path": "/lessons/plan-mode",
    "title": {
      "zh": "Plan Mode · 计划模式",
      "en": "Plan Mode"
    },
    "description": {
      "zh": "需求澄清、方案制定、计划与执行的边界。",
      "en": "Requirements, planning, and the boundary between planning and execution."
    },
    "status": "planned"
  },
  {
    "id": "goal-mode",
    "order": 10,
    "path": "/lessons/goal-mode",
    "title": {
      "zh": "Goal Mode · 目标模式",
      "en": "Goal Mode"
    },
    "description": {
      "zh": "持续推进目标、进度管理、预算与终止条件。",
      "en": "Goal progress, budgets, and stopping conditions."
    },
    "status": "planned"
  },
  {
    "id": "subagent",
    "order": 11,
    "path": "/lessons/subagent",
    "title": {
      "zh": "Subagent · 子 Agent",
      "en": "Subagents"
    },
    "description": {
      "zh": "任务委派、上下文传递、生命周期与结果收集。",
      "en": "Task delegation, context transfer, lifecycle, and result collection."
    },
    "status": "planned"
  },
  {
    "id": "agent-team",
    "order": 12,
    "path": "/lessons/agent-team",
    "title": {
      "zh": "Agent Team · 多 Agent 协作",
      "en": "Agent Teams"
    },
    "description": {
      "zh": "角色分工、并行任务、消息协调与结果整合。",
      "en": "Roles, parallel tasks, messaging, and result integration."
    },
    "status": "planned"
  },
  {
    "id": "self-evolution",
    "order": 13,
    "path": "/lessons/self-evolution",
    "title": {
      "zh": "Self-Evolution · 自进化机制",
      "en": "Self-Evolution"
    },
    "description": {
      "zh": "自进化机制专题，内容待编写。",
      "en": "A chapter on self-evolution, with content to come."
    },
    "status": "planned"
  },
  {
    "id": "computer-use",
    "order": 14,
    "path": "/lessons/computer-use",
    "title": {
      "zh": "Computer Use · 计算机操作",
      "en": "Computer Use"
    },
    "description": {
      "zh": "计算机操作专题，内容待编写。",
      "en": "A chapter on computer use, with content to come."
    },
    "status": "planned"
  }
];
