export const agentLoopArchitecture = {
  zh: {
    title: "把手动操作，写成一个循环",
    opening: "回头看刚才的过程：我们把文件交给 AI，拿到回答后修改文件，再把新内容发回去。要把这件事自动化，就要写一套程序，接手这些来回操作。",
    tools: "先给模型提供可用工具的说明，比如读取文件、修改文件、执行命令。模型需要某个文件时，不再让我们手动复制，而是返回一条工具调用，告诉程序要调用哪个工具、传什么参数。真正读取或修改文件的，仍然是我们写的程序。",
    modulesTitle: "这套程序可以按职责拆成什么？",
    modules: [
      { title: "模型请求 · Request LLM API", body: "把用户需求、已有对话和工具说明发给模型，接收它返回的文本与工具调用。" },
      { title: "响应解析 · Response", body: "识别模型返回了什么。如果是工具调用，就取出工具名、参数和调用 ID，比如要读取哪个文件。" },
      { title: "工具执行 · Tool Runner", body: "根据工具名找到对应实现，检查参数与权限，再执行操作。把成功结果或失败信息整理成工具输出。" },
      { title: "上下文记录 · History", body: "记下模型的回答、工具调用和对应结果。下一次请求要带上这些记录，模型才知道文件里有什么、刚才的操作是否成功。" },
      { title: "循环控制 · Agent Loop", body: "把上面几部分接起来：请求模型，执行工具，记录结果，再请求模型。决定什么时候继续，什么时候结束。" },
    ],
    loop: "比如模型先要求读取 README。程序读完，把内容发回模型；模型看到文件后，又要求修改它。程序完成修改，再把执行结果发回去。一次工具调用不一定能完成任务，所以这里需要的是循环，而不是只调用一次 API。",
    ending: "先看最简单的正常流程：只要模型还返回工具调用，程序就执行并回传结果；当一次模型响应结束、没有新的工具调用时，这轮循环就可以结束，把回答交给用户。",
    caveat: "这里按职责拆分，是为了理解最小循环，不是规定源码必须拆成这五个文件。真实 Codex 还会处理新输入、取消、错误等分支；没有工具调用，也不等于任务结果一定正确。",
  },
  en: {
    title: "Turn the manual work into a loop",
    opening: "Look back at the demo: we gave the AI a file, used its reply to edit that file, and sent the new contents back. Automating this means writing a program to handle that back-and-forth.",
    tools: "First, describe the available tools to the model: reading files, editing files, or running commands. Instead of asking us to copy a file, the model can return a tool call with a name and arguments. Our program—not the model itself—performs the operation.",
    modulesTitle: "What responsibilities does the program need?",
    modules: [
      { title: "Model request · Request LLM API", body: "Send the user's request, conversation history, and tool definitions to the model. Receive text and tool calls." },
      { title: "Response parsing · Response", body: "Identify what the model returned. For a tool call, extract its name, arguments, and call ID—for example, the file to read." },
      { title: "Tool execution · Tool Runner", body: "Find the implementation, check arguments and permissions, and execute the operation. Return its result or failure information." },
      { title: "Context recording · History", body: "Record model responses, tool calls, and their matching outputs. Include them in the next request so the model can use the file contents and operation results." },
      { title: "Loop control · Agent Loop", body: "Connect the pieces: request the model, execute tools, record results, and request the model again. Decide when to continue and when to stop." },
    ],
    loop: "For example, the model first requests README. The program reads it and sends the contents back. The model then requests an edit; the program performs it and returns the result. One tool call may not finish the task, so this needs a loop, not a single API request.",
    ending: "In the simplest successful path, keep executing and returning tool results while the model requests tools. Once a model response completes without new tool calls, the loop can finish and present the reply to the user.",
    caveat: "These are conceptual responsibilities, not a requirement to create five source files. Real Codex also handles new input, cancellation, errors, and other branches. Having no tool calls does not guarantee a correct result.",
  },
} as const;
