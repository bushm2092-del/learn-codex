import type { LessonDefinition } from "./types";

// planned 章节只展示目录，不开放尚未实现的路由。
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
    "status": "draft"
  },
  {
    "id": "model-protocols",
    "order": 2,
    "path": "/lessons/model-protocols",
    "title": {
      "zh": "Responses / Chat · 模型协议",
      "en": "Responses / Chat Protocols"
    },
    "description": {
      "zh": "对比两种协议的消息结构、上下文和流式事件。",
      "en": "Compare message structures, context, and streaming events."
    },
    "status": "planned"
  },
  {
    "id": "function-call",
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
    "status": "planned"
  },
  {
    "id": "mcp",
    "order": 4,
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
    "order": 5,
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
    "order": 6,
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
    "order": 7,
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
    "order": 8,
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
    "order": 9,
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
    "order": 10,
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
  }
];
