const requestCode = `async fn request_llm_api(history, tools) -> Result<Reply> {
    let response = http.post(
        "https://api.deepseek.com/chat/completions"
    )
        .bearer_auth(env("DEEPSEEK_API_KEY")?)
        .json(json!({
            "model": model,
            "messages": history,
            "tools": tools,
            "stream": false
        }))
        .send().await?
        .error_for_status()?;

    let body = response.json().await?;
    parse_response(body)
}`;

const responseCode = `fn parse_response(body) -> Result<Reply> {
    let message = body["choices"][0]["message"].clone();
    let tool_calls = message["tool_calls"]
        .as_array().unwrap_or_empty()
        .map(|call| ToolCall {
            id: call["id"].clone(),
            name: call["function"]["name"].clone(),
            arguments: call["function"]["arguments"].clone(),
        });

    Ok(Reply { message, tool_calls })
}`;

const toolsCode = (description: string) => `fn available_tools() {
    vec![json!({
        "type": "function",
        "function": {
            "name": "exec_command",
            "description": "${description}",
            "parameters": {
                "type": "object",
                "properties": { "cmd": { "type": "string" } },
                "required": ["cmd"]
            }
        }
    })]
}`;

const runnerCode = `async fn run_tool(name, arguments) {
    if name != "exec_command" {
        return json!({ "error": "Unknown tool" });
    }
    let args = match parse_json(arguments) {
        Ok(args) => args,
        Err(error) => return json!({ "error": error.to_string() }),
    };
    let Some(cmd) = args["cmd"].as_str() else {
        return json!({ "error": "cmd must be a string" });
    };

    match Command::new(shell)
        .args(["-c", cmd])
        .current_dir(thread_cwd)
        .output().await
    {
        Ok(output) => json!({
            "exit_code": output.status.code(),
            "stdout": output.stdout,
            "stderr": output.stderr
        }),
        Err(error) => json!({ "error": error.to_string() }),
    }
}`;

const messagesCode = `fn system(prompt) {
    json!({ "role": "system", "content": prompt })
}

fn user(task) {
    json!({ "role": "user", "content": task })
}

impl Reply {
    fn as_message(&self) {
        self.message.clone()
    }
}

fn tool_result(call_id, result) {
    json!({
        "role": "tool",
        "tool_call_id": call_id,
        "content": result.to_string()
    })
}`;

// 同一份伪代码按语言插入注释，避免双语版本的逻辑发生漂移。
const commentRules = [
  ["let response = http.post(", "请求模型：程序通过 HTTP 与模型通信", "Request the model over HTTP"],
  ['.bearer_auth(env("DEEPSEEK_API_KEY")?)', "从环境变量读取密钥，不写在网页或源码中", "Read the API key from the environment, not page or source code"],
  [".json(json!({", "发送模型名、完整历史和工具说明；本例不用流式响应", "Send model, full history and tools; use a non-streaming response"],
  [".send().await?", "等待网络返回；网络错误通过 ? 向上传递", "Await the response; propagate network errors with ?"],
  [".error_for_status()?;", "非成功 HTTP 状态按错误处理", "Treat unsuccessful HTTP status codes as errors"],
  ["let body = response.json().await?;", "把响应体读成 JSON，再交给解析模块", "Read the response body as JSON for the parser"],
  ['let message = body["choices"][0]["message"].clone();', "取出第一条 assistant 消息；省略响应结构校验", "Extract the first assistant message; shape validation is omitted"],
  ['let tool_calls = message["tool_calls"]', "没有 tool_calls 时得到空列表，主循环据此结束", "Missing tool_calls becomes an empty list, allowing the loop to stop"],
  [".map(|call| ToolCall {", "整理调用 ID、工具名和参数；此处不执行工具", "Extract call ID, tool name and arguments without executing tools"],
  ['arguments: call["function"]["arguments"].clone(),', "参数仍是 JSON 字符串，留到工具执行时解析", "Keep arguments as a JSON string until tool execution"],
  ["Ok(Reply { message, tool_calls })", "保留原始消息用于历史，调用列表用于工具分发", "Keep the original message for history and calls for dispatch"],
  ["fn available_tools() {", "工具定义只告诉 AI 能调用什么，不会运行命令", "Tool definitions describe capabilities; they do not run commands"],
  ['"parameters": {', "参数格式：模型应传入包含 cmd 字符串的对象", "Argument schema: an object containing a cmd string"],
  ['if name != "exec_command" {', "只允许已注册的工具名，未知工具返回错误结果", "Reject unknown tool names with an error result"],
  ["let args = match parse_json(arguments) {", "解析模型传来的参数；解析失败也回传给模型", "Parse model arguments; return parsing failures to the model too"],
  ['let Some(cmd) = args["cmd"].as_str() else {', "检查 cmd 存在且为字符串", "Require cmd to exist and be a string"],
  ["match Command::new(shell)", "由程序启动 shell 执行命令；这里没有沙箱保障", "The program starts the shell; this sketch provides no sandbox"],
  [".current_dir(thread_cwd)", "使用当前会话的工作目录，决定相对路径指向哪里", "Resolve relative paths from the thread working directory"],
  [".output().await", "等待命令结束，收集退出状态、标准输出和错误输出", "Wait for completion and collect status, stdout and stderr"],
  ["Ok(output) => json!({", "进程成功启动不代表命令成功，还要看 exit_code", "A launched process may still fail; inspect exit_code"],
  ['Err(error) => json!({ "error": error.to_string() }),', "启动失败也返回结果，让模型知道发生了什么", "Return launch failures so the model can react"],
  ["fn system(prompt) {", "系统消息：告诉模型角色、规则和工作方式", "System message: role, rules and working instructions"],
  ["fn user(task) {", "用户消息：记录这一轮的需求", "User message: the task for this turn"],
  ["self.message.clone()", "保留整条 assistant 消息，不能丢掉 tool_calls", "Preserve the full assistant message, including tool_calls"],
  ["fn tool_result(call_id, result) {", "构造工具消息，主循环会把它追加到 history", "Build the tool message for the loop to append to history"],
  ['"tool_call_id": call_id,', "调用 ID 必须与 assistant 中对应的工具调用一致", "The ID must match the corresponding assistant tool call"],
  ['"content": result.to_string()', "把执行结果序列化成文本，供下一次请求使用", "Serialize the result as text for the next request"],
] as const;

function annotate(code: string, locale: "zh" | "en") {
  return code.split("\n").map((line) => {
    const rule = commentRules.find(([target]) => line.trim() === target);
    if (!rule) return line;
    const indent = line.match(/^\s*/)?.[0] ?? "";
    return `${indent}// ${rule[locale === "zh" ? 1 : 2]}\n${line}`;
  }).join("\n");
}

const functionCopy = {
  zh: {
    title: "Loop：把各部分串起来",
    note: "下面是分模块的 Rust 风格伪代码，不是实际源码文件。省略类型、导入和 SDK 细节；http、env、parse_json、Command 代表基础库能力。model、shell、thread_cwd 由入口配置。这里用 DeepSeek Chat 协议说明，与内核的 Responses 协议不同。",
    sections: [
      { title: "模型请求", label: "llm_api.rs · 伪代码", body: "把历史和工具定义发给 API，收到 JSON 后交给 parse_response。请求失败向上返回错误，不伪装成模型回复。", code: requestCode },
      { title: "响应解析", label: "response.rs · 伪代码", body: "取出 assistant 消息，把工具调用整理为主循环使用的 Reply。arguments 保留为 JSON 字符串，执行时再解析；原始 message 留给上下文记录。", code: responseCode },
      { title: "工具执行", label: "tools.rs · 伪代码", body: "available_tools 描述工具，run_tool 才真正执行。只分发已注册的工具，检查参数后在 thread 工作目录运行。stdout、stderr 在实际实现中需要解码为文本；执行失败也作为结果回传。这段示意没有沙箱或审批保障，不能直接用于执行不可信命令。", code: toolsCode("在工作目录中运行 shell 命令") + "\n\n" + runnerCode },
      { title: "上下文记录", label: "messages.rs · 伪代码", body: "system 和 user 构造初始消息。as_message 保留完整 assistant 消息，包括 tool_calls；tool_result 用调用 ID 把执行结果与它对应起来。主循环按顺序追加到 history，下一次请求就能看到完整过程。", code: messagesCode },
    ],
  },
  en: {
    title: "Loop: connect the parts",
    note: "These are separate Rust-style pseudocode modules, not source files. Types, imports and SDK details are omitted. http, env, parse_json and Command represent library primitives; model, shell and thread_cwd are configured at the entry point. This example uses DeepSeek Chat, not the core’s Responses protocol.",
    sections: [
      { title: "Model request", label: "llm_api.rs · Pseudocode", body: "Send history and tool definitions to the API, then pass the JSON to parse_response. Request failures propagate as errors.", code: requestCode },
      { title: "Response parsing", label: "response.rs · Pseudocode", body: "Extract the assistant message and normalize its tool calls into Reply. Keep arguments as a JSON string until execution and preserve the original message for history.", code: responseCode },
      { title: "Tool execution", label: "tools.rs · Pseudocode", body: "available_tools describes tools; run_tool executes them. Dispatch registered tools after validating arguments. Decode stdout and stderr as text in a real implementation, and return execution failures too. This sketch provides no sandbox or approval protection for untrusted commands.", code: toolsCode("Run a shell command in the working directory") + "\n\n" + runnerCode },
      { title: "Context recording", label: "messages.rs · Pseudocode", body: "system and user create initial messages. as_message preserves the full assistant message, including tool_calls. tool_result matches the output to its call ID. The loop appends them to history in order for the next request.", code: messagesCode },
    ],
  },
};

export const agentLoopFunctions = {
  zh: { ...functionCopy.zh, sections: functionCopy.zh.sections.map((section) => ({ ...section, code: annotate(section.code, "zh") })) },
  en: { ...functionCopy.en, sections: functionCopy.en.sections.map((section) => ({ ...section, code: annotate(section.code, "en") })) },
};
