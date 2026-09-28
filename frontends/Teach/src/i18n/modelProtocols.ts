export const modelProtocols = {
  zh: {
    overview: "通过 HTTP 调用模型，既然是 HTTP 请求，就一定有请求参数和返回值的格式规定；这些规定由模型协议定义。",
    sections: ["如何在代码中和 AI 对话", "协议", "OpenAI 的 Chat 协议"],
    paragraphs: [
      ["在代码中和 AI 对话，其实就是发送 HTTP 请求。按照模型厂商文档提供的接口地址和参数要求，发送请求，再从响应中取出模型的回答即可。"],
      ["上面这段 JSON，就是发送给模型的请求参数。市面上有 GLM、DeepSeek、Qwen、GPT、Claude 等模型，难道每换一家，都要重新组织请求参数、重新解析返回值吗？", "协议解决的就是这类问题：约定请求参数和返回值的格式。不同厂商兼容同一套协议，我们就能复用主要的请求和解析逻辑，而不用为每个模型重写一遍。", "不过，各家接口也会围绕自己的能力和生态演进，并没有统一成一种格式。常见的有 OpenAI Chat Completions API、OpenAI Responses API，以及 Claude 使用的 Anthropic Messages API。适配几套常见协议，比为每个模型单独实现一套要简单得多。", "兼容不代表完全相同：切换服务时，仍要调整接口地址、Key 和模型名，部分可选参数也可能不同。下面先看 Chat 的核心格式。"],
      ["这里的 Chat 协议，指 OpenAI 的 Chat Completions API。程序向 /v1/chat/completions 发送请求，用 model 指定模型，用 messages 传入对话。", "messages 中，每条消息用 role 表示是谁说的，用 content 表示说了什么。user 是用户，assistant 是模型。", "普通文本回答位于响应的 choices[0].message.content。下一次追问时，把之前的问题、回答和新的问题一起放进 messages，模型就能接着这段对话回答。"],
    ],
    reference: "参考：OpenAI Chat Completions 文档",
    curlLabel: "curl 是发送 HTTP 请求的 Bash 命令",
    requestLabel: "请求参数 · JSON",
    responseLabel: "响应示意 · 仅保留核心字段，回答并非固定值",
    toolExampleLabels: ["工具调用 · 第一次请求（示意）", "模型返回的工具调用（示意）", "执行工具后 · 第二次请求（示意）"],
    fields: ["model：选择要调用的模型。", "messages：按顺序传入历史消息和本次问题；role 表示角色，content 表示内容。", "stream：false 表示等待完整响应，而不是逐段接收。", "max_tokens：本例中限制最多生成 256 个 token，不等于 256 个汉字；具体参数以所用模型文档为准。"],
    chatDetails: [
      {title: "消息角色与顺序", items: ["为什么要区分这些角色？因为这里的 LLM API 不会自动记住之前的对话，每次调用都需要重新发送模型需要的历史信息。本例将完整对话历史一起传入，再用 role 标明：哪些话是用户说的，哪些是 AI 的回答，哪些是程序为 AI 设定的全局规则。", "system 是系统提示词，用于设定角色和规则；user 表示用户输入；assistant 表示模型回答；tool 表示工具执行结果。OpenAI 的部分新模型使用 developer 承载应用指令，是否支持取决于接口和模型。", "messages 按对话顺序排列。继续追问时，将上一轮的问题和回答保留，再追加新的 user 消息；不是只发最后一句话。", "本例的 content 是文本。支持多模态的模型还可以接收内容块数组，例如文字和图片，具体类型由模型决定。"]},
      {title: "返回值里有什么", items: ["choices 是回答列表，本例读取第一项。message 是模型这次返回的消息，普通文本在 message.content 中。", "finish_reason 表示为什么停止：stop 通常是正常结束，length 表示达到长度限制，tool_calls 表示模型提出了工具调用。", "响应还通常包含 id、model 和 usage；usage 记录输入、输出等 token 用量。上面的示意省略了这些辅助字段。"]},
      {title: "完整响应与流式响应", items: ["stream: false 一次返回完整 JSON；stream: true 通过 SSE 逐段返回数据，文字增量通常位于 choices[0].delta.content，需要程序按顺序拼接。"]},
      {title: "工具调用也有格式", items: ["请求中的 tools 描述可用工具及参数结构；模型用 message.tool_calls 返回调用 ID、工具名和参数，而不是直接执行工具。", "程序执行后，把模型的工具调用消息和 role 为 tool 的结果加入 messages。结果用 tool_call_id 对应原调用，再发起下一次请求。工具参数 arguments 是 JSON 字符串，下一章再展开。"]},
    ],
    contextNote: "可以看出，调用模型其实就是发送一次 HTTP 请求，并且 LLM 是没有记忆的。模型要了解之前发生了什么，就需要我们把历史消息、相关文件和工具结果等上下文，通过请求参数一起传过去。因此，harness 的核心职责之一，就是管理和组织这些上下文，并在发起 LLM API 请求时将模型需要的上下文以请求参数的方式发送出去。",
    note: "本章正在编写，内容将陆续补充。",
    back: "回顾上一章：Agent Loop · 执行循环",
  },
  en: {
    overview: "Calling a model over HTTP is still an HTTP request, so there must be rules for request parameters and responses—defined by the model protocol.",
    sections: ["How to talk to AI in code", "Protocols", "OpenAI’s Chat protocol"],
    paragraphs: [
      ["Talking to AI in code is simply sending an HTTP request. Follow the model provider’s documentation for the endpoint and required parameters, send the request, and read the model’s answer from the response."],
      ["The JSON above contains the model’s request parameters. With models such as GLM, DeepSeek, Qwen, GPT, and Claude, must we rebuild requests and response parsing every time we switch providers?", "Protocols address this by defining request and response formats. Providers that support the same protocol let us reuse the main request and parsing logic instead of rewriting it for each model.", "There is no single universal format: interfaces evolve around different capabilities and ecosystems. Common formats include OpenAI Chat Completions, OpenAI Responses, and Anthropic Messages for Claude. Supporting a few common protocols is simpler than implementing a separate integration for every model.", "Compatibility is not identity. Endpoints, keys, model names, and some optional parameters still differ. Let’s start with the core Chat format."],
      ["Here, Chat means OpenAI’s Chat Completions API. The program sends a request to /v1/chat/completions, selects a model with model, and supplies the conversation in messages.", "Each message has a role identifying the speaker and content containing what they said. user represents the user; assistant represents the model.", "A plain text answer is in choices[0].message.content. For a follow-up, include the earlier question, answer, and new question in messages so the model can continue the conversation."],
    ],
    reference: "Reference: OpenAI Chat Completions documentation",
    curlLabel: "curl is a Bash command for sending HTTP requests",
    requestLabel: "Request parameters · JSON",
    responseLabel: "Illustrative response · core fields only; actual answers vary",
    toolExampleLabels: ["Tool call · first request (illustrative)", "Model's tool call (illustrative)", "After execution · second request (illustrative)"],
    fields: ["model: selects the model.", "messages: supplies prior messages and the current question in order; role identifies the speaker and content holds the text.", "stream: false waits for a complete response instead of receiving chunks.", "max_tokens: caps generation at 256 tokens in this example, not 256 characters. Check the selected model’s documentation for supported parameters."],
    chatDetails: [
      {title: "Message roles and order", items: ["Why distinguish these roles? This LLM API does not automatically remember earlier conversations, so each call must resend the history the model needs. This example includes the full conversation and uses role to identify what the user said, what the AI replied, and which global instructions the application set for the AI.", "system carries the system prompt, which sets the role and rules; user carries user input; assistant carries model replies; tool carries tool results. Some newer OpenAI models use developer for application instructions; support depends on the endpoint and model.", "Keep messages in conversational order. For a follow-up, retain the previous question and reply, then append the new user message—not just the last sentence.", "This example uses text content. Multimodal models may also accept arrays of content parts such as text and images, depending on model support."]},
      {title: "Reading the response", items: ["choices contains the answers; this example uses the first entry. message is the model’s returned message, with ordinary text in message.content.", "finish_reason explains why generation stopped: stop usually means a normal ending, length means a length limit was reached, and tool_calls means the model requested tools.", "Responses also commonly include id, model, and usage. usage reports input, output, and other token counts; the illustration omits these supporting fields."]},
      {title: "Complete and streamed responses", items: ["stream: false returns a complete JSON response. stream: true sends SSE chunks; text increments typically appear in choices[0].delta.content and must be assembled in order."]},
      {title: "Tool calls have a format too", items: ["tools describes available tools and their parameter schemas. The model returns call IDs, names, and arguments in message.tool_calls; it does not execute the tools itself.", "After execution, append the assistant’s tool-call message and the tool results to messages. Each tool result uses role: tool and tool_call_id to identify the original call before the next request. arguments is a JSON string; the next chapter explains this further."]},
    ],
    contextNote: "Calling a model is simply sending an HTTP request, and the LLM has no memory of its own. To let it know what happened before, we include prior messages, relevant files, and tool results in the request parameters. One of the harness’s core responsibilities is to manage and organize this context, then send the context the model needs as request parameters when making an LLM API request.",
    note: "This chapter is being written. More content is coming.",
    back: "Review the previous chapter: Agent Loop",
  },
} as const;

export const curlExample = [
  "curl https://api.deepseek.com/chat/completions \\",
  '  -H "Content-Type: application/json" \\',
  '  -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" \\',
  "  -d '{",
  '        "model": "deepseek-flash",',
  '        "messages": [',
  '          {"role": "system", "content": "You are a helpful assistant."},',
  '          {"role": "user", "content": "Hello!"}',
  "        ],",
  '        "thinking": {"type": "enabled"},',
  '        "reasoning_effort": "high",',
  '        "stream": false',
  "      }'",
].join("\n");

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

const weatherParameters = {
  type: "object",
  properties: { location: { type: "string", description: "城市名称" } },
  required: ["location"],
};
const chatWeatherTool = {
  type: "function",
  function: { name: "get_weather", description: "查询指定城市的当前气温", parameters: weatherParameters },
};
const weatherQuestion = { role: "user", content: "杭州现在多少度？" };
const weatherCallId = "call_weather_1";
const weatherArguments = JSON.stringify({ location: "杭州" });
const weatherResult = JSON.stringify({ temperature_c: 24 });
const chatWeatherCall = {
  role: "assistant",
  content: null,
  tool_calls: [{ id: weatherCallId, type: "function", function: { name: "get_weather", arguments: weatherArguments } }],
};
export const chatToolRequest = JSON.stringify({
  model: "deepseek-flash",
  messages: [weatherQuestion],
  tools: [chatWeatherTool],
  stream: false,
});
export const chatToolResponse = JSON.stringify({
  model: "deepseek-flash",
  choices: [{ index: 0, message: chatWeatherCall, finish_reason: "tool_calls" }],
});
export const chatToolFollowup = JSON.stringify({
  model: "deepseek-flash",
  messages: [weatherQuestion, chatWeatherCall, { role: "tool", tool_call_id: weatherCallId, content: weatherResult }],
  tools: [chatWeatherTool],
  stream: false,
});

export const responsesProtocol = {
  zh: {
    title: "OpenAI 的 Responses 协议",
    whyTitle: "有了 Chat，为什么还需要 Responses？",
    why: [
      "Chat 最初围绕对话消息设计。随着模型开始处理图片、调用工具、进行多步推理，一次调用的结果不再只是“一句回答”，还可能包含工具调用、工具结果和推理相关条目。",
      "Chat 虽然支持工具和多模态，但读取一次响应要先从 choices 中取出 message，再根据 content、tool_calls 等字段判断是文本回答还是工具调用，缺少统一的条目 type。之后的 Responses API 提供了更加简洁统一的接口：在 output 中用带 type 的条目分别表示消息、工具调用等结果。",
    ],
    requestLabel: "POST /v1/responses · 请求示意",
    responseLabel: "响应示意 · 省略辅助字段",
    toolExampleLabels: ["工具调用 · 第一次请求（示意）", "模型返回的 function_call（示意）", "执行工具后 · 第二次请求（示意）"],
    chatComparison: "相比于之前的 Chat 协议，是不是清爽多了？",
    note: "下面是格式：",
    parts: [
      { title: "从消息列表到条目列表", items: ["input 接收本次输入，可以是文本，也可以是消息、工具结果等条目组成的数组；instructions 单独承载本次调用的角色和规则。", "返回值不再用 choices 包装回答，而是使用 output 数组。每个条目通过 type 区分，例如 message、function_call 或 reasoning。"] },
      { title: "工具调用如何衔接", items: ["模型返回 function_call 条目，包含 name、arguments 和 call_id。程序执行自定义工具后，用 function_call_output 条目回传结果，并用 call_id 对应原调用。"] },
      { title: "刚刚的例子没有传递历史内容：是不是不用再传历史了？，LLm api有记忆了？", items: [ "是因为Responses 协议定义了 previous_response_id 参数；如果服务端支持，就可以用上一次响应的 ID 自动衔接历史。原理还是一样的：模型需要的上下文必须在调用时提供，并不是 LLM 自己记住了对话。", "对 harness 来说，核心仍然是组织上下文、执行工具并继续调用模型，只是协议提供了更简单的状态衔接方式。"] },
    ],
    reference: "参考：为什么推出 Responses API",
  },
  en: {
    title: "OpenAI’s Responses protocol",
    whyTitle: "Why Responses when Chat already exists?",
    why: [
      "Chat was designed around conversational messages. With images, tools, and multi-step reasoning, a call can produce more than a text reply: it may include tool calls, results, and reasoning-related items.",
      "Chat supports tools and multimodal content too, but reading a response means getting message from choices, then checking fields such as content and tool_calls to distinguish a text reply from a tool call. There is no unified item-level type. The later Responses API offers a simpler, more unified interface: typed items in output represent messages, tool calls, and other results.",
    ],
    requestLabel: "POST /v1/responses · illustrative request",
    responseLabel: "Illustrative response · supporting fields omitted",
    toolExampleLabels: ["Tool call · first request (illustrative)", "Model's function_call (illustrative)", "After execution · second request (illustrative)"],
    chatComparison: "Compared with the earlier Chat protocol, doesn't this feel much cleaner?",
    note: "The format is shown below:",
    parts: [
      { title: "From messages to typed items", items: ["input accepts text or an array of items such as messages and tool results. instructions supplies the role and rules for this call.", "output replaces choices. Each item has a type, such as message, function_call, or reasoning."] },
      { title: "Continuing tool calls", items: ["A function_call item carries name, arguments, and call_id. Your application executes the custom tool and returns a function_call_output item linked by call_id."] },
      { title: "Do we still send history?", items: ["You can manage history yourself by resending prior input and output items with the new question.", "The Responses protocol defines previous_response_id. If the service supports it, the previous response ID can connect the history automatically. The principle is unchanged: the model must receive the context it needs for each call; it does not remember the conversation itself.", "The harness still organizes context, executes tools, and calls the model again. Responses offers explicit item types and ways to connect that state."] },
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

const responsesWeatherTool = {
  type: "function",
  name: "get_weather",
  description: "查询指定城市的当前气温",
  parameters: weatherParameters,
};
const weatherResponseId = "resp_weather_1";
export const responsesToolRequest = JSON.stringify({
  model: "MODEL_ID",
  input: [weatherQuestion],
  tools: [responsesWeatherTool],
});
export const responsesToolResponse = JSON.stringify({
  id: weatherResponseId,
  output: [{ type: "function_call", id: "fc_weather_1", call_id: weatherCallId, name: "get_weather", arguments: weatherArguments }],
});
export const responsesToolFollowup = JSON.stringify({
  model: "MODEL_ID",
  previous_response_id: weatherResponseId,
  input: [{ type: "function_call_output", call_id: weatherCallId, output: weatherResult }],
  tools: [responsesWeatherTool],
});
