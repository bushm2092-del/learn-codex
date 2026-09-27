export const loopDebugger = {
  zh: {
    changed: "已变化",
    variables: "变量 · 点击展开完整值", unset: "尚未赋值 / 不在作用域内", request: "本次请求 JSON", response: "API 响应 JSON", code: "执行位置（高亮行执行后）",
    phases: ["发送请求，等待 API 返回", "收到响应，赋值给 reply", "把模型回复追加到 history", "检查 tool_calls 是否为空", "执行当前 call，得到 result", "将 result 追加到 history，回到循环开头"],
    done: "tool_calls 为空，执行 break，循环结束",
  },
  en: {
    changed: "Changed",
    variables: "Variables · Expand to inspect", unset: "Unassigned / out of scope", request: "Request JSON", response: "API response JSON", code: "Execution (after highlighted line)",
    phases: ["Send request; await API response", "Receive response; assign reply", "Append the model reply to history", "Check whether tool_calls is empty", "Execute call; assign result", "Append result to history; repeat the loop"],
    done: "Empty tool_calls: break ends the loop",
  },
};
