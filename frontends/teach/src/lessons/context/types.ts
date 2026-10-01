export type Bilingual = { zh: string; en: string };
export type MessageKind = "environment" | "user" | "assistant" | "tool_call" | "tool_result" | "summary" | "compaction" | "trigger" | "developer";
export interface ContextMessage { id: string; kind: MessageKind; text: string }
export interface ContextStep {
  title: Bilingual;
  body: Bilingual;
  code: string;
  rows: { label: string; items: ContextMessage[] }[];
  meter?: { used: number; limit: number; formula: string };
}
export interface ContextTrace { title: Bilingual; note: Bilingual; steps: ContextStep[] }
