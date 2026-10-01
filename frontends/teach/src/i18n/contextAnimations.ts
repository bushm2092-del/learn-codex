import type { ContextTrace } from "../lessons/context/types";
export const contextAnimations: Record<string, ContextTrace> = {
  "conversation": {
    "title": {
      "zh": "消息不是一次写完的",
      "en": "Messages arrive over time"
    },
    "note": {
      "zh": "手动前进观察每次 record_items；tool_call / tool_result 是显示简称。",
      "en": "Step through record_items; tool labels are display aliases."
    },
    "steps": [
      {
        "title": {
          "zh": "会话建立",
          "en": "Session starts"
        },
        "body": {
          "zh": "先记录环境。本例关闭 TokenBudget。",
          "en": "Record environment; TokenBudget is off in this example."
        },
        "code": "Session::spawn → ContextManager::with_items",
        "rows": [
          {
            "label": "history",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "用户输入到达",
          "en": "User input arrives"
        },
        "body": {
          "zh": "检查旧上下文后，记录 user。首次 Prompt.input 使用整理后的副本。",
          "en": "After checking existing context, record user; normalize a copy for the first request."
        },
        "code": "run_turn → record_items → clone().for_prompt()",
        "rows": [
          {
            "label": "history",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              }
            ]
          },
          {
            "label": "Prompt.input",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "模型完成工具调用项",
          "en": "Model completes a call"
        },
        "body": {
          "zh": "OutputItemDone 先写 history，再排入工具 future。",
          "en": "Record the completed call before enqueuing its tool future."
        },
        "code": "OutputItemDone → record_items → in_flight.push_back",
        "rows": [
          {
            "label": "history",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "工具执行完成",
          "en": "Tool finishes"
        },
        "body": {
          "zh": "Completed 更新 usage；drain 把结果写回，以 c1 配对。",
          "en": "Completed updates usage; drain records the result paired by c1."
        },
        "code": "response.completed → usage → drain → record_items",
        "rows": [
          {
            "label": "history",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "r1",
                "kind": "tool_result",
                "text": "c1 · npm run dev"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "第二次请求重放结果",
          "en": "Next request replays the result"
        },
        "body": {
          "zh": "needs_follow_up 为 true。结果不是另发一条用户消息。",
          "en": "needs_follow_up is true. The tool output remains a protocol item."
        },
        "code": "loop → Prompt { input: history.clone().for_prompt(), … }",
        "rows": [
          {
            "label": "Prompt.input",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "r1",
                "kind": "tool_result",
                "text": "c1 · npm run dev"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "模型给出回答",
          "en": "Model answers"
        },
        "body": {
          "zh": "完整 assistant 项写入历史；delta 只更新显示。",
          "en": "Record the complete assistant item; deltas only update display."
        },
        "code": "OutputItemDone → record_items → TurnCompleted",
        "rows": [
          {
            "label": "history",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "r1",
                "kind": "tool_result",
                "text": "c1 · npm run dev"
              },
              {
                "id": "a1",
                "kind": "assistant",
                "text": "使用 npm run dev / Use npm run dev"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "下一轮追问",
          "en": "Next user turn"
        },
        "body": {
          "zh": "同一 Session 追加 user₂，再重放之前的内容。",
          "en": "Append user2 to the same Session and replay prior content."
        },
        "code": "UserTurn → run_turn → record_items",
        "rows": [
          {
            "label": "history",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "r1",
                "kind": "tool_result",
                "text": "c1 · npm run dev"
              },
              {
                "id": "a1",
                "kind": "assistant",
                "text": "使用 npm run dev / Use npm run dev"
              },
              {
                "id": "u2",
                "kind": "user",
                "text": "检查启动脚本 / Check script"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "第二个工具结果进入历史",
          "en": "Second tool result"
        },
        "body": {
          "zh": "调用与结果继续追加。模型下次看到的是整个整理后的序列。",
          "en": "Calls and outputs keep appending; the next request uses the normalized sequence."
        },
        "code": "call₂ → result₂ → needs_follow_up",
        "rows": [
          {
            "label": "history",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "r1",
                "kind": "tool_result",
                "text": "c1 · npm run dev"
              },
              {
                "id": "a1",
                "kind": "assistant",
                "text": "使用 npm run dev / Use npm run dev"
              },
              {
                "id": "u2",
                "kind": "user",
                "text": "检查启动脚本 / Check script"
              },
              {
                "id": "c2",
                "kind": "tool_call",
                "text": "c2 · read package.json"
              },
              {
                "id": "r2",
                "kind": "tool_result",
                "text": "c2 · vite"
              }
            ]
          }
        ]
      }
    ]
  },
  "normalize": {
    "title": {
      "zh": "发送前修复调用链",
      "en": "Repair the chain before sending"
    },
    "note": {
      "zh": "上下两行分清活动历史与发送副本。补齐不会执行工具。",
      "en": "Separate active history from the send copy. Repair does not run tools."
    },
    "steps": [
      {
        "title": {
          "zh": "原始历史存在缺口",
          "en": "Raw history has a gap"
        },
        "body": {
          "zh": "c1 没有结果，orphan 没有调用。",
          "en": "c1 has no output; orphan has no call."
        },
        "code": "raw_items()",
        "rows": [
          {
            "label": "history",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "orphan",
                "kind": "tool_result",
                "text": "orphan · no matching call"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "克隆后补齐结果",
          "en": "Clone and repair"
        },
        "body": {
          "zh": "ensure_call_outputs_present 插入 aborted，不修改原历史。",
          "en": "Insert aborted on the copy, leaving active history intact."
        },
        "code": "history.clone() → ensure_call_outputs_present",
        "rows": [
          {
            "label": "history",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "orphan",
                "kind": "tool_result",
                "text": "orphan · no matching call"
              }
            ]
          },
          {
            "label": "send copy",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "missing",
                "kind": "tool_result",
                "text": "c1 · aborted"
              },
              {
                "id": "orphan",
                "kind": "tool_result",
                "text": "orphan · no matching call"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "删除孤立结果",
          "en": "Remove orphan output"
        },
        "body": {
          "zh": "这里只删除有 call_id 却找不到调用的 orphan；保留例外见正文。",
          "en": "Remove the orphan with an unmatched call_id; exceptions are described above."
        },
        "code": "remove_orphan_outputs",
        "rows": [
          {
            "label": "history",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "orphan",
                "kind": "tool_result",
                "text": "orphan · no matching call"
              }
            ]
          },
          {
            "label": "Prompt.input",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "missing",
                "kind": "tool_result",
                "text": "c1 · aborted"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "请求中配对闭合",
          "en": "Input chain is paired"
        },
        "body": {
          "zh": "发送 c1 + aborted；raw history 仍有原始缺口。",
          "en": "Send c1 + aborted; raw history still has the original gap."
        },
        "code": "for_prompt() → Vec<ResponseItem>",
        "rows": [
          {
            "label": "history",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "orphan",
                "kind": "tool_result",
                "text": "orphan · no matching call"
              }
            ]
          },
          {
            "label": "Prompt.input",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "missing",
                "kind": "tool_result",
                "text": "c1 · aborted"
              }
            ]
          }
        ]
      }
    ]
  },
  "usage": {
    "title": {
      "zh": "不要把累计账单当作窗口大小",
      "en": "Cumulative usage is not window size"
    },
    "note": {
      "zh": "教学数值：服务端 1,000，新增结果约 2，下一次服务端 1,200。",
      "en": "Illustrative counts: reported 1,000, a two-token result, then reported 1,200."
    },
    "steps": [
      {
        "title": {
          "zh": "收到服务端 usage",
          "en": "Server usage arrives"
        },
        "body": {
          "zh": "last = 1000；累计 = 1000。",
          "en": "Latest = 1000; cumulative = 1000."
        },
        "code": "update_token_usage_info(Some(usage))",
        "rows": [
          {
            "label": "latest model items",
            "items": [
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              }
            ]
          }
        ],
        "meter": {
          "used": 1000,
          "limit": 2000,
          "formula": "last = 1,000 · cumulative = 1,000"
        }
      },
      {
        "title": {
          "zh": "本地工具结果尚未发送",
          "en": "Tool result not sent yet"
        },
        "body": {
          "zh": "新增结果估算 2，窗口 = 1002。累计账单没有因本地追加而变大。",
          "en": "The local result adds an estimated 2: window = 1002. Cumulative reported usage is unchanged."
        },
        "code": "get_total_token_usage() = last.total_tokens + tail",
        "rows": [
          {
            "label": "history",
            "items": [
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "two",
                "kind": "tool_result",
                "text": "c1 · estimated 2 tokens"
              }
            ]
          }
        ],
        "meter": {
          "used": 1002,
          "limit": 2000,
          "formula": "1,000 + 2 = 1,002"
        }
      },
      {
        "title": {
          "zh": "再次发送完整输入",
          "en": "Send the next request"
        },
        "body": {
          "zh": "旧调用与结果一起重放，不把上一轮账单再次相加。",
          "en": "Replay the chain without adding the previous bill again."
        },
        "code": "Prompt.input = history.clone().for_prompt()",
        "rows": [
          {
            "label": "Prompt.input",
            "items": [
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "two",
                "kind": "tool_result",
                "text": "c1 · estimated 2 tokens"
              }
            ]
          }
        ],
        "meter": {
          "used": 1002,
          "limit": 2000,
          "formula": "current window = 1,002"
        }
      },
      {
        "title": {
          "zh": "新 usage 覆盖旧基线",
          "en": "New usage replaces baseline"
        },
        "body": {
          "zh": "服务端报告 1200；累计 2200；窗口用 1200。工具结果已被覆盖。",
          "en": "The server reports 1200; cumulative is 2200, current window is 1200."
        },
        "code": "TokenUsageInfo::new_or_append",
        "rows": [
          {
            "label": "history",
            "items": [
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "two",
                "kind": "tool_result",
                "text": "c1 · output"
              },
              {
                "id": "a1",
                "kind": "assistant",
                "text": "使用 npm run dev / Use npm run dev"
              }
            ]
          }
        ],
        "meter": {
          "used": 1200,
          "limit": 2000,
          "formula": "last = 1,200 · cumulative = 2,200"
        }
      },
      {
        "title": {
          "zh": "安装压缩历史后重算",
          "en": "Rebase after replacement"
        },
        "body": {
          "zh": "replace 后估算新历史 + instructions，保留累计量；此处 300 仅为示例。",
          "en": "After replace, estimate new history plus instructions; preserve cumulative usage. 300 is illustrative."
        },
        "code": "replace → recompute_token_usage",
        "rows": [
          {
            "label": "new history",
            "items": [
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "summary",
                "kind": "summary",
                "text": "交接摘要 / Handoff summary"
              }
            ]
          }
        ],
        "meter": {
          "used": 300,
          "limit": 2000,
          "formula": "new estimated baseline = 300 · cumulative = 2,200"
        }
      }
    ]
  },
  "local": {
    "title": {
      "zh": "从八条消息到用户意图与摘要",
      "en": "From eight items to users and a summary"
    },
    "note": {
      "zh": "展示工具后压缩：环境插在最后真实 user 前，摘要在最后。",
      "en": "Mid-turn compaction: environment before the latest real user, summary last."
    },
    "steps": [
      {
        "title": {
          "zh": "达到阈值",
          "en": "Threshold reached"
        },
        "body": {
          "zh": "还有工具后的模型请求，因此进入压缩。",
          "en": "Another model request is needed after tools, so compaction runs."
        },
        "code": "needs_follow_up && token_limit_reached",
        "rows": [
          {
            "label": "history",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "r1",
                "kind": "tool_result",
                "text": "c1 · npm run dev"
              },
              {
                "id": "a1",
                "kind": "assistant",
                "text": "使用 npm run dev / Use npm run dev"
              },
              {
                "id": "u2",
                "kind": "user",
                "text": "检查启动脚本 / Check script"
              },
              {
                "id": "c2",
                "kind": "tool_call",
                "text": "c2 · read package.json"
              },
              {
                "id": "r2",
                "kind": "tool_result",
                "text": "c2 · vite"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "只在副本追加总结指令",
          "en": "Append prompt only to the copy"
        },
        "body": {
          "zh": "tools = []，parallel_tool_calls = false；基础 instructions 保留。",
          "en": "No tools, parallel calls off; base instructions unchanged."
        },
        "code": "clone → SUMMARIZATION_PROMPT → ModelClient::stream",
        "rows": [
          {
            "label": "live history",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "r1",
                "kind": "tool_result",
                "text": "c1 · npm run dev"
              },
              {
                "id": "a1",
                "kind": "assistant",
                "text": "使用 npm run dev / Use npm run dev"
              },
              {
                "id": "u2",
                "kind": "user",
                "text": "检查启动脚本 / Check script"
              },
              {
                "id": "c2",
                "kind": "tool_call",
                "text": "c2 · read package.json"
              },
              {
                "id": "r2",
                "kind": "tool_result",
                "text": "c2 · vite"
              }
            ]
          },
          {
            "label": "summary request",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "r1",
                "kind": "tool_result",
                "text": "c1 · npm run dev"
              },
              {
                "id": "a1",
                "kind": "assistant",
                "text": "使用 npm run dev / Use npm run dev"
              },
              {
                "id": "u2",
                "kind": "user",
                "text": "检查启动脚本 / Check script"
              },
              {
                "id": "c2",
                "kind": "tool_call",
                "text": "c2 · read package.json"
              },
              {
                "id": "r2",
                "kind": "tool_result",
                "text": "c2 · vite"
              },
              {
                "id": "instruction",
                "kind": "user",
                "text": "生成交接摘要 / Summarize"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "等待完整摘要响应",
          "en": "Wait for the complete summary"
        },
        "body": {
          "zh": "完成的 assistant 摘要先写 live history；必须等 Completed。",
          "en": "Record the completed assistant summary in live history; wait for Completed."
        },
        "code": "drain_to_completed",
        "rows": [
          {
            "label": "live history",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "r1",
                "kind": "tool_result",
                "text": "c1 · npm run dev"
              },
              {
                "id": "a1",
                "kind": "assistant",
                "text": "使用 npm run dev / Use npm run dev"
              },
              {
                "id": "u2",
                "kind": "user",
                "text": "检查启动脚本 / Check script"
              },
              {
                "id": "c2",
                "kind": "tool_call",
                "text": "c2 · read package.json"
              },
              {
                "id": "r2",
                "kind": "tool_result",
                "text": "c2 · vite"
              },
              {
                "id": "ai-summary",
                "kind": "assistant",
                "text": "已读 README；下一步核对脚本 / Handoff"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "提取真实用户消息",
          "en": "Extract real user messages"
        },
        "body": {
          "zh": "排除环境、旧摘要与非 user 项；这里只收集，不截断。",
          "en": "Exclude environment, old summaries, and non-user items; no truncation yet."
        },
        "code": "collect_annotated_user_messages",
        "rows": [
          {
            "label": "snapshot",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "r1",
                "kind": "tool_result",
                "text": "c1 · npm run dev"
              },
              {
                "id": "a1",
                "kind": "assistant",
                "text": "使用 npm run dev / Use npm run dev"
              },
              {
                "id": "u2",
                "kind": "user",
                "text": "检查启动脚本 / Check script"
              },
              {
                "id": "c2",
                "kind": "tool_call",
                "text": "c2 · read package.json"
              },
              {
                "id": "r2",
                "kind": "tool_result",
                "text": "c2 · vite"
              },
              {
                "id": "ai-summary",
                "kind": "assistant",
                "text": "已读 README；下一步核对脚本 / Handoff"
              }
            ]
          },
          {
            "label": "selected users",
            "items": [
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "u2",
                "kind": "user",
                "text": "检查启动脚本 / Check script"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "预算内保留并追加摘要",
          "en": "Retain users and append summary"
        },
        "body": {
          "zh": "最近优先，20,000 粗估 token；恢复顺序；摘要是 user 角色。",
          "en": "Newest-first within 20,000 estimated tokens; restore order; summary has user role."
        },
        "code": "build_compacted_history",
        "rows": [
          {
            "label": "new history",
            "items": [
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "u2",
                "kind": "user",
                "text": "检查启动脚本 / Check script"
              },
              {
                "id": "summary",
                "kind": "summary",
                "text": "交接摘要 / Handoff summary"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "注入环境，替换并重算",
          "en": "Inject, install, and rebase"
        },
        "body": {
          "zh": "旧 assistant / tools 不逐条保留，它们的信息由摘要接替。",
          "en": "Old assistants and tools are not retained individually; the summary carries their information."
        },
        "code": "insert_initial_context → replace → recompute_token_usage",
        "rows": [
          {
            "label": "before",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "r1",
                "kind": "tool_result",
                "text": "c1 · npm run dev"
              },
              {
                "id": "a1",
                "kind": "assistant",
                "text": "使用 npm run dev / Use npm run dev"
              },
              {
                "id": "u2",
                "kind": "user",
                "text": "检查启动脚本 / Check script"
              },
              {
                "id": "c2",
                "kind": "tool_call",
                "text": "c2 · read package.json"
              },
              {
                "id": "r2",
                "kind": "tool_result",
                "text": "c2 · vite"
              }
            ]
          },
          {
            "label": "after",
            "items": [
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u2",
                "kind": "user",
                "text": "检查启动脚本 / Check script"
              },
              {
                "id": "summary",
                "kind": "summary",
                "text": "交接摘要 / Handoff summary"
              }
            ]
          }
        ]
      }
    ]
  },
  "remote": {
    "title": {
      "zh": "普通 Responses 流里的 compaction_trigger",
      "en": "compaction_trigger in a normal Responses stream"
    },
    "note": {
      "zh": "压缩输出在 attempt 内收集，验证成功才安装。",
      "en": "Collect inside the attempt; install only after validation."
    },
    "steps": [
      {
        "title": {
          "zh": "准备历史副本",
          "en": "Prepare the copy"
        },
        "body": {
          "zh": "只按窗口改写连续尾部工具输出，然后 for_prompt 整理。",
          "en": "Rewrite contiguous trailing outputs against the window, then normalize."
        },
        "code": "rewrite_history_for_compaction → for_prompt",
        "rows": [
          {
            "label": "history",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "r1",
                "kind": "tool_result",
                "text": "c1 · npm run dev"
              },
              {
                "id": "a1",
                "kind": "assistant",
                "text": "使用 npm run dev / Use npm run dev"
              },
              {
                "id": "u2",
                "kind": "user",
                "text": "检查启动脚本 / Check script"
              },
              {
                "id": "c2",
                "kind": "tool_call",
                "text": "c2 · read package.json"
              },
              {
                "id": "r2",
                "kind": "tool_result",
                "text": "c2 · vite"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "发送压缩信号",
          "en": "Send the trigger"
        },
        "body": {
          "zh": "input 末尾追加 trigger；保留当前 tools 和 instructions。",
          "en": "Append trigger to input; retain current tools and instructions."
        },
        "code": "input.push(ResponseItem::CompactionTrigger) → stream",
        "rows": [
          {
            "label": "Prompt.input",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "r1",
                "kind": "tool_result",
                "text": "c1 · npm run dev"
              },
              {
                "id": "a1",
                "kind": "assistant",
                "text": "使用 npm run dev / Use npm run dev"
              },
              {
                "id": "u2",
                "kind": "user",
                "text": "检查启动脚本 / Check script"
              },
              {
                "id": "c2",
                "kind": "tool_call",
                "text": "c2 · read package.json"
              },
              {
                "id": "r2",
                "kind": "tool_result",
                "text": "c2 · vite"
              },
              {
                "id": "trigger",
                "kind": "trigger",
                "text": "compaction_trigger"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "收到加密压缩项",
          "en": "Receive encrypted compaction"
        },
        "body": {
          "zh": "先收集，不写 live history，也不解密 encrypted_content。",
          "en": "Collect without writing live history or decrypting the content."
        },
        "code": "OutputItemDone(ResponseItem::Compaction { … })",
        "rows": [
          {
            "label": "live history",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "r1",
                "kind": "tool_result",
                "text": "c1 · npm run dev"
              },
              {
                "id": "a1",
                "kind": "assistant",
                "text": "使用 npm run dev / Use npm run dev"
              },
              {
                "id": "u2",
                "kind": "user",
                "text": "检查启动脚本 / Check script"
              },
              {
                "id": "c2",
                "kind": "tool_call",
                "text": "c2 · read package.json"
              },
              {
                "id": "r2",
                "kind": "tool_result",
                "text": "c2 · vite"
              }
            ]
          },
          {
            "label": "attempt output",
            "items": [
              {
                "id": "encrypted",
                "kind": "compaction",
                "text": "encrypted_content"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "验证完整性",
          "en": "Validate completion"
        },
        "body": {
          "zh": "必须 response.completed，且恰好一个 Compaction；失败不安装。",
          "en": "Require response.completed and exactly one Compaction; invalid output is not installed."
        },
        "code": "collect_compaction_output → validation",
        "rows": [
          {
            "label": "validated output",
            "items": [
              {
                "id": "encrypted",
                "kind": "compaction",
                "text": "encrypted_content"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "保留用户，安装加密项",
          "en": "Retain users and install"
        },
        "body": {
          "zh": "用户预算 64,000；环境按时机注入；重算基线。",
          "en": "Retain users within 64,000 tokens, reinject environment, recompute baseline."
        },
        "code": "build_v2_compacted_history → replace → recompute",
        "rows": [
          {
            "label": "before",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "r1",
                "kind": "tool_result",
                "text": "c1 · npm run dev"
              },
              {
                "id": "a1",
                "kind": "assistant",
                "text": "使用 npm run dev / Use npm run dev"
              },
              {
                "id": "u2",
                "kind": "user",
                "text": "检查启动脚本 / Check script"
              },
              {
                "id": "c2",
                "kind": "tool_call",
                "text": "c2 · read package.json"
              },
              {
                "id": "r2",
                "kind": "tool_result",
                "text": "c2 · vite"
              }
            ]
          },
          {
            "label": "after",
            "items": [
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "u2",
                "kind": "user",
                "text": "检查启动脚本 / Check script"
              },
              {
                "id": "encrypted",
                "kind": "compaction",
                "text": "encrypted_content"
              }
            ]
          }
        ]
      }
    ]
  },
  "budget": {
    "title": {
      "zh": "换窗口，不生成摘要",
      "en": "A new window without a summary"
    },
    "note": {
      "zh": "展示工具后切换：旧任务也被清空。instructions 仍在 Prompt 中。",
      "en": "Mid-turn rollover clears the old task too. Prompt instructions remain."
    },
    "steps": [
      {
        "title": {
          "zh": "TokenBudget 优先命中",
          "en": "TokenBudget takes priority"
        },
        "body": {
          "zh": "不再查询 provider 来决定摘要路线。",
          "en": "Skip summary route selection based on provider."
        },
        "code": "Feature::TokenBudget → compact_token_budget",
        "rows": [
          {
            "label": "history",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "win1",
                "kind": "developer",
                "text": "first = w1 · current = w1"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "r1",
                "kind": "tool_result",
                "text": "c1 · npm run dev"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "推进窗口身份",
          "en": "Advance window identity"
        },
        "body": {
          "zh": "first 保留；previous 指向 w1；current 变为新的 UUID。图中 w1/w2 是简称。",
          "en": "Preserve first, set previous to w1, create a new UUID. w1/w2 are aliases."
        },
        "code": "AutoCompactWindow::advance",
        "rows": [
          {
            "label": "old history",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "win1",
                "kind": "developer",
                "text": "first = w1 · current = w1"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "r1",
                "kind": "tool_result",
                "text": "c1 · npm run dev"
              }
            ]
          },
          {
            "label": "new identity",
            "items": [
              {
                "id": "win2",
                "kind": "developer",
                "text": "first = w1 · previous = w1 · current = w2"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "重建基础上下文",
          "en": "Rebuild initial context"
        },
        "body": {
          "zh": "环境 + developer 窗口标识 + 可选指导。没有旧任务或隐藏摘要。",
          "en": "Environment, developer window identity, optional guidance; no old task or hidden summary."
        },
        "code": "initial_world_state + initial_context",
        "rows": [
          {
            "label": "replacement",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "win2",
                "kind": "developer",
                "text": "first = w1 · previous = w1 · current = w2"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "安装并重算",
          "en": "Install and rebase"
        },
        "body": {
          "zh": "提醒/fallback 标志已重置，下一窗口可以再次提醒。",
          "en": "Reminder/fallback flags are reset for the next window."
        },
        "code": "history.replace → recompute_token_usage",
        "rows": [
          {
            "label": "before",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "win1",
                "kind": "developer",
                "text": "first = w1 · current = w1"
              },
              {
                "id": "u1",
                "kind": "user",
                "text": "读取 README / Read README"
              },
              {
                "id": "c1",
                "kind": "tool_call",
                "text": "c1 · read README"
              },
              {
                "id": "r1",
                "kind": "tool_result",
                "text": "c1 · npm run dev"
              }
            ]
          },
          {
            "label": "after",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "win2",
                "kind": "developer",
                "text": "first = w1 · previous = w1 · current = w2"
              }
            ]
          }
        ]
      },
      {
        "title": {
          "zh": "继续普通采样",
          "en": "Resume normal sampling"
        },
        "body": {
          "zh": "工具后直接用这两项继续；采样前切换则随后追加本次新 user。",
          "en": "Mid-turn sampling resumes with these two items; pre-turn rollover appends the incoming user afterward."
        },
        "code": "Prompt { instructions, tools, input: new_history, … }",
        "rows": [
          {
            "label": "Prompt.input",
            "items": [
              {
                "id": "env",
                "kind": "environment",
                "text": "cwd · shell"
              },
              {
                "id": "win2",
                "kind": "developer",
                "text": "first = w1 · previous = w1 · current = w2"
              }
            ]
          }
        ]
      }
    ]
  }
};
export const contextTransport = {"zh": {"contents": "本章阅读路径", "transcript": "阅读全部步骤（文字版）", "play": "播放", "pause": "暂停", "restart": "重播", "previous": "上一步", "next": "下一步", "seek": "动画进度", "step": "步骤", "sample": "教学样例 · 非线上测量", "select": "查看步骤", "count": "条目", "initial": "基础 instructions 始终独立于 input"}, "en": {"contents": "Chapter reading path", "transcript": "Read every step (text version)", "play": "Play", "pause": "Pause", "restart": "Replay", "previous": "Previous", "next": "Next", "seek": "Animation progress", "step": "Step", "sample": "Illustrative data · not live measurements", "select": "Inspect step", "count": "items", "initial": "Base instructions stay separate from input"}};
