export const modelProtocols = {
  zh: {
    sections: ["如何在代码中和 AI 对话", "没有协议怎么办", "OpenAI 的 Chat 协议"],
    paragraphs: [
      ["在代码中和 AI 对话，其实就是发送 HTTP 请求。按照模型厂商文档提供的接口地址和参数要求，发送请求，再从响应中取出模型的回答即可。"],
      ["程序能发送请求，还需要知道：问题放在哪里？使用哪个模型？回答从哪里取？", "如果双方没有约定格式，一边发送 question，另一边却读取 messages，就无法正确交流。即使各自都能调用，不同服务各用一套格式，接入时也要分别适配。", "协议就是双方约定的交流规则。这里重点看请求和响应的数据格式。"],
      ["这里的 Chat 协议，指 OpenAI 的 Chat Completions API。程序向 /v1/chat/completions 发送请求，用 model 指定模型，用 messages 传入对话。", "messages 中，每条消息用 role 表示是谁说的，用 content 表示说了什么。user 是用户，assistant 是模型。", "普通文本回答位于响应的 choices[0].message.content。下一次追问时，把之前的问题、回答和新的问题一起放进 messages，模型就能接着这段对话回答。"],
    ],
    reference: "参考：OpenAI Chat Completions 文档",
    note: "本章正在编写，内容将陆续补充。",
    back: "回顾上一章：Agent Loop · 执行循环",
  },
  en: {
    sections: ["How to talk to AI in code", "What if there is no protocol?", "OpenAI’s Chat protocol"],
    paragraphs: [
      ["Talking to AI in code is simply sending an HTTP request. Follow the model provider’s documentation for the endpoint and required parameters, send the request, and read the model’s answer from the response."],
      ["Sending a request is not enough. Where does the question go? Which model should answer? Where is the answer in the response?", "Without an agreed format, one side might send question while the other expects messages. When services use different formats, each integration needs its own adapter.", "A protocol is an agreed set of communication rules. Here we focus on request and response formats."],
      ["Here, Chat means OpenAI’s Chat Completions API. The program sends a request to /v1/chat/completions, selects a model with model, and supplies the conversation in messages.", "Each message has a role identifying the speaker and content containing what they said. user represents the user; assistant represents the model.", "A plain text answer is in choices[0].message.content. For a follow-up, include the earlier question, answer, and new question in messages so the model can continue the conversation."],
    ],
    reference: "Reference: OpenAI Chat Completions documentation",
    note: "This chapter is being written. More content is coming.",
    back: "Review the previous chapter: Agent Loop",
  },
} as const;
