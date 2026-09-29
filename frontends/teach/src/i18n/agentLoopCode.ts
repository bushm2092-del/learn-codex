const example = (comments: readonly string[]) => `// ${comments[0]}
let tools = available_tools();
// ${comments[1]}
let mut history = vec![system(system_prompt), user(user_prompt)];

// ${comments[2]}
loop {
    // ${comments[3]}
    let reply = request_llm_api(&history, &tools).await?;
    // ${comments[4]}
    history.push(reply.as_message());

    // ${comments[5]}
    if reply.tool_calls.is_empty() {
        break;
    }

    // ${comments[6]}
    for call in reply.tool_calls {
        let result = run_tool(&call.name, &call.arguments).await;
        // ${comments[7]}
        history.push(tool_result(call.id, result));
    }
    // ${comments[8]}
}`;

export const agentLoopCode = {
  zh: {
    title: "用代码把循环串起来",
    intro: "程序做的事情很直接：带着历史和工具定义请求 AI，执行它提出的工具调用，把结果记入历史，再请求一次。",
    label: "Agent Loop · 伪代码",
    code: example([
      "准备可用工具：名称、用途和参数格式",
      "历史从系统提示词和用户需求开始；mut 表示可以修改",
      "loop 会一直重复，直到遇到 break",
      "把历史和工具定义交给 AI；await 等待响应，? 传出请求错误",
      "先记下 AI 的回复，包括它提出的工具调用",
      "没有工具调用，就退出循环；最终回复已在历史中",
      "遍历本次调用：程序按工具名和参数执行，不是模型直接操作文件",
      "用 call.id 对应原来的调用，把成功或失败结果记入历史",
      "回到循环开头：AI 看到工具结果，再决定下一步",
    ]),
    note: "工具结果也包括执行失败的信息。下一次请求会带上这些结果，让 AI 决定接下来做什么。这里省略了流式响应、取消、循环上限和请求错误处理，不是可直接运行的 Rust。",
  },
  en: {
    title: "Put the loop into code",
    intro: "Send the history and tool definitions to the AI, execute its tool calls, append the results to history, then request again.",
    label: "Agent Loop · Pseudocode",
    code: example([
      "Define available tools: names, descriptions and parameter schemas",
      "Start with system instructions and the user task; mut allows changes",
      "loop repeats until break is reached",
      "Send history and tools; await waits, ? propagates request errors",
      "Record the AI reply first, including its tool calls",
      "No tool calls: exit; the final reply is already in history",
      "Run each tool by name and arguments; the program does the work",
      "Match success or failure results to the original call using call.id",
      "Repeat: the AI sees the results and decides what to do next",
    ]),
    note: "Tool results also include execution failures. The next request carries these results so the AI can decide what to do next. Streaming, cancellation, loop limits and request errors are omitted; this is not runnable Rust.",
  },
};
