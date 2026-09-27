export const modelProtocols = {
  zh: {
    sections: ["如何在代码中和 AI 对话", "协议", "OpenAI 的 Chat 协议"],
    paragraphs: [
      ["在代码中和 AI 对话，其实就是发送 HTTP 请求。按照模型厂商文档提供的接口地址和参数要求，发送请求，再从响应中取出模型的回答即可。"],
      ["上面这段 JSON，就是发送给模型的请求参数。市面上有 GLM、DeepSeek、Qwen、GPT、Claude 等模型，难道每换一家，都要重新组织请求参数、重新解析返回值吗？", "协议解决的就是这类问题：约定请求参数和返回值的格式。不同厂商兼容同一套协议，我们就能复用主要的请求和解析逻辑，而不用为每个模型重写一遍。", "不过，各家接口也会围绕自己的能力和生态演进，并没有统一成一种格式。常见的有 OpenAI Chat Completions API、OpenAI Responses API，以及 Claude 使用的 Anthropic Messages API。适配几套常见协议，比为每个模型单独实现一套要简单得多。", "兼容不代表完全相同：切换服务时，仍要调整接口地址、Key 和模型名，部分可选参数也可能不同。下面先看 Chat 的核心格式。"],
      ["这里的 Chat 协议，指 OpenAI 的 Chat Completions API。程序向 /v1/chat/completions 发送请求，用 model 指定模型，用 messages 传入对话。", "messages 中，每条消息用 role 表示是谁说的，用 content 表示说了什么。user 是用户，assistant 是模型。", "普通文本回答位于响应的 choices[0].message.content。下一次追问时，把之前的问题、回答和新的问题一起放进 messages，模型就能接着这段对话回答。"],
    ],
    reference: "参考：OpenAI Chat Completions 文档",
    requestLabel: "请求参数 · JSON",
    responseLabel: "响应示意 · 仅保留核心字段，回答并非固定值",
    fields: ["model：选择要调用的模型。", "messages：按顺序传入历史消息和本次问题；role 表示角色，content 表示内容。", "stream：false 表示等待完整响应，而不是逐段接收。", "max_tokens：本例中限制最多生成 256 个 token，不等于 256 个汉字；具体参数以所用模型文档为准。"],
    chatDetails: [
      {title: "消息角色与顺序", items: ["为什么要区分这些角色？因为这里的 LLM API 不会自动记住之前的对话，每次调用都需要重新发送模型需要的历史信息。本例将完整对话历史一起传入，再用 role 标明：哪些话是用户说的，哪些是 AI 的回答，哪些是程序为 AI 设定的全局规则。", "system 是系统提示词，用于设定角色和规则；user 表示用户输入；assistant 表示模型回答；tool 表示工具执行结果。OpenAI 的部分新模型使用 developer 承载应用指令，是否支持取决于接口和模型。", "messages 按对话顺序排列。继续追问时，将上一轮的问题和回答保留，再追加新的 user 消息；不是只发最后一句话。", "本例的 content 是文本。支持多模态的模型还可以接收内容块数组，例如文字和图片，具体类型由模型决定。"]},
      {title: "返回值里有什么", items: ["choices 是回答列表，本例读取第一项。message 是模型这次返回的消息，普通文本在 message.content 中。", "finish_reason 表示为什么停止：stop 通常是正常结束，length 表示达到长度限制，tool_calls 表示模型提出了工具调用。", "响应还通常包含 id、model 和 usage；usage 记录输入、输出等 token 用量。上面的示意省略了这些辅助字段。"]},
      {title: "完整响应与流式响应", items: ["stream: false 一次返回完整 JSON；stream: true 通过 SSE 逐段返回数据，文字增量通常位于 choices[0].delta.content，需要程序按顺序拼接。", "本页沙箱只演示非流式调用。流式接口改变的是接收方式，不是让模型自动保存历史。"]},
      {title: "工具调用也有格式", items: ["请求中的 tools 描述可用工具及参数结构；模型用 message.tool_calls 返回调用 ID、工具名和参数，而不是直接执行工具。", "程序执行后，把模型的工具调用消息和 role 为 tool 的结果加入 messages。结果用 tool_call_id 对应原调用，再发起下一次请求。工具参数 arguments 是 JSON 字符串，下一章再展开。"]},
    ],
    contextNote: "可以看出，调用模型其实就是发送一次 HTTP 请求，并且 LLM 是没有记忆的。模型要了解之前发生了什么，就需要我们把历史消息、相关文件和工具结果等上下文，通过请求参数一起传过去。因此，harness 的核心职责之一，就是管理和组织这些上下文，让模型在每次调用时拿到完成当前任务所需的信息。",
    note: "本章正在编写，内容将陆续补充。",
    back: "回顾上一章：Agent Loop · 执行循环",
  },
  en: {
    sections: ["How to talk to AI in code", "Protocols", "OpenAI’s Chat protocol"],
    paragraphs: [
      ["Talking to AI in code is simply sending an HTTP request. Follow the model provider’s documentation for the endpoint and required parameters, send the request, and read the model’s answer from the response."],
      ["The JSON above contains the model’s request parameters. With models such as GLM, DeepSeek, Qwen, GPT, and Claude, must we rebuild requests and response parsing every time we switch providers?", "Protocols address this by defining request and response formats. Providers that support the same protocol let us reuse the main request and parsing logic instead of rewriting it for each model.", "There is no single universal format: interfaces evolve around different capabilities and ecosystems. Common formats include OpenAI Chat Completions, OpenAI Responses, and Anthropic Messages for Claude. Supporting a few common protocols is simpler than implementing a separate integration for every model.", "Compatibility is not identity. Endpoints, keys, model names, and some optional parameters still differ. Let’s start with the core Chat format."],
      ["Here, Chat means OpenAI’s Chat Completions API. The program sends a request to /v1/chat/completions, selects a model with model, and supplies the conversation in messages.", "Each message has a role identifying the speaker and content containing what they said. user represents the user; assistant represents the model.", "A plain text answer is in choices[0].message.content. For a follow-up, include the earlier question, answer, and new question in messages so the model can continue the conversation."],
    ],
    reference: "Reference: OpenAI Chat Completions documentation",
    requestLabel: "Request parameters · JSON",
    responseLabel: "Illustrative response · core fields only; actual answers vary",
    fields: ["model: selects the model.", "messages: supplies prior messages and the current question in order; role identifies the speaker and content holds the text.", "stream: false waits for a complete response instead of receiving chunks.", "max_tokens: caps generation at 256 tokens in this example, not 256 characters. Check the selected model’s documentation for supported parameters."],
    chatDetails: [
      {title: "Message roles and order", items: ["Why distinguish these roles? This LLM API does not automatically remember earlier conversations, so each call must resend the history the model needs. This example includes the full conversation and uses role to identify what the user said, what the AI replied, and which global instructions the application set for the AI.", "system carries the system prompt, which sets the role and rules; user carries user input; assistant carries model replies; tool carries tool results. Some newer OpenAI models use developer for application instructions; support depends on the endpoint and model.", "Keep messages in conversational order. For a follow-up, retain the previous question and reply, then append the new user message—not just the last sentence.", "This example uses text content. Multimodal models may also accept arrays of content parts such as text and images, depending on model support."]},
      {title: "Reading the response", items: ["choices contains the answers; this example uses the first entry. message is the model’s returned message, with ordinary text in message.content.", "finish_reason explains why generation stopped: stop usually means a normal ending, length means a length limit was reached, and tool_calls means the model requested tools.", "Responses also commonly include id, model, and usage. usage reports input, output, and other token counts; the illustration omits these supporting fields."]},
      {title: "Complete and streamed responses", items: ["stream: false returns a complete JSON response. stream: true sends SSE chunks; text increments typically appear in choices[0].delta.content and must be assembled in order.", "This playground supports non-streaming calls only. Streaming changes how output is received; it does not automatically preserve conversation history."]},
      {title: "Tool calls have a format too", items: ["tools describes available tools and their parameter schemas. The model returns call IDs, names, and arguments in message.tool_calls; it does not execute the tools itself.", "After execution, append the assistant’s tool-call message and the tool results to messages. Each tool result uses role: tool and tool_call_id to identify the original call before the next request. arguments is a JSON string; the next chapter explains this further."]},
    ],
    contextNote: "Calling a model is simply sending an HTTP request, and the LLM has no memory of its own. To let it know what happened before, we include prior messages, relevant files, and tool results in the request parameters. One of the harness’s core responsibilities is to manage and organize this context, giving the model the information it needs for the current task on every call.",
    note: "This chapter is being written. More content is coming.",
    back: "Review the previous chapter: Agent Loop",
  },
} as const;

export const chatRequest = JSON.stringify({
  model: "deepseek-flash",
  messages: [
    { role: "user", content: "你是谁" },
    { role: "assistant", content: "我是deepseek" },
    { role: "user", content: "我的上一句话是什么？" },
  ],
  stream: false,
  max_tokens: 256,
});
export const chatResponse = JSON.stringify({
  model: "deepseek-flash",
  choices: [{ index: 0, message: { role: "assistant", content: "你的上一句话是：你是谁。" }, finish_reason: "stop" }],
});

export const responsesProtocol = {
  zh: {
    title: "OpenAI 的 Responses 协议",
    whyTitle: "有了 Chat，为什么还需要 Responses？",
    why: [
      "Chat 最初围绕对话消息设计。随着模型开始处理图片、调用工具、进行多步推理，一次调用的结果不再只是“一句回答”，还可能包含工具调用、工具结果和推理相关条目。",
      "Chat 也支持工具和多模态，但 OpenAI 希望用更统一的接口承载这些能力，于是推出 Responses API：把消息和工具调用等都表示为带类型的条目，并整合内置工具与上下文衔接能力。它不只是给 Chat 换了几个字段名。",
    ],
    requestLabel: "POST /v1/responses · 请求示意",
    responseLabel: "响应示意 · 省略辅助字段",
    note: "下面是格式示意，MODEL_ID 需替换为支持 Responses 的模型。本页 DeepSeek 沙箱仍使用 Chat 接口，不运行此示例。",
    parts: [
      { title: "从消息列表到条目列表", items: ["input 接收本次输入，可以是文本，也可以是消息、工具结果等条目组成的数组；instructions 单独承载本次调用的角色和规则。", "返回值不再用 choices 包装回答，而是使用 output 数组。每个条目通过 type 区分，例如 message、function_call 或 reasoning。", "文本在 message 条目的 content 中，以 output_text 类型承载。不能假定 output 第一项一定是文本回答；SDK 的 output_text 是汇总文本的便捷属性，不是这里原始 JSON 的顶层字段。"] },
      { title: "工具调用如何衔接", items: ["模型返回 function_call 条目，包含 name、arguments 和 call_id。程序执行自定义工具后，用 function_call_output 条目回传结果，并用 call_id 对应原调用。", "Responses 还提供搜索等内置工具，由服务端处理相应调用；自定义函数仍由你的程序执行。具体工具支持取决于模型与服务商。"] },
      { title: "是不是不用再传历史了？", items: ["可以自行管理历史，把先前的输入、输出条目和新问题一起传回；也可以在服务支持的情况下，用 previous_response_id 引用上一次响应，由服务端衔接上下文。", "这不是 LLM 自己有了记忆，而是 API 服务替你保存和组织上下文。使用 previous_response_id 时，上一次的 instructions 不会自动继承，需要重新传入。", "对 harness 来说，核心仍然是组织上下文、执行工具并继续调用模型，只是协议提供了更明确的条目结构和状态衔接方式。"] },
    ],
    reference: "参考：为什么推出 Responses API",
  },
  en: {
    title: "OpenAI’s Responses protocol",
    whyTitle: "Why Responses when Chat already exists?",
    why: [
      "Chat was designed around conversational messages. With images, tools, and multi-step reasoning, a call can produce more than a text reply: it may include tool calls, results, and reasoning-related items.",
      "Chat supports tools and multimodal content too. Responses provides a unified interface with typed items, built-in tools, and context continuation. It is more than a set of renamed Chat fields.",
    ],
    requestLabel: "POST /v1/responses · illustrative request",
    responseLabel: "Illustrative response · supporting fields omitted",
    note: "Replace MODEL_ID with a model supporting Responses. The DeepSeek playground on this page still uses Chat and does not run this example.",
    parts: [
      { title: "From messages to typed items", items: ["input accepts text or an array of items such as messages and tool results. instructions supplies the role and rules for this call.", "output replaces choices. Each item has a type, such as message, function_call, or reasoning.", "Text appears as output_text content inside a message item. Do not assume the first output item is a text message. The SDK’s output_text convenience property aggregates text; it is not a top-level field in the raw JSON shown here."] },
      { title: "Continuing tool calls", items: ["A function_call item carries name, arguments, and call_id. Your application executes the custom tool and returns a function_call_output item linked by call_id.", "Built-in tools such as search can be handled by the service. Custom functions still run in your application; support varies by model and provider."] },
      { title: "Do we still send history?", items: ["You can manage history yourself, resending prior input and output items with the new question. Where supported, previous_response_id lets the service connect the new call to a previous response.", "This is service-managed context, not memory inside the LLM. Previous instructions are not inherited through previous_response_id and must be sent again.", "The harness still organizes context, executes tools, and calls the model again. Responses offers explicit item types and ways to connect that state."] },
    ],
    reference: "Reference: Why we built the Responses API",
  },
} as const;

export const responsesRequest = JSON.stringify({
  model: "MODEL_ID",
  instructions: "你是一个助手，用中文简短回答。",
  input: [{ role: "user", content: "你是谁" }],
});
export const responsesResponse = JSON.stringify({
  id: "resp_example",
  output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "我是一个 AI 助手。" }] }],
});
