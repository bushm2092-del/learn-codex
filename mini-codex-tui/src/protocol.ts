// 与 app-server 的教学协议子集对应；不是完整 Codex SDK。
export type Item =
  | {type: 'agentMessage'; id: string; text: string}
  | {type: 'commandExecution'; id: string; command: string; status: string; aggregatedOutput: string | null};
export type Turn = {id: string; status: 'inProgress' | 'completed' | 'failed'; error: {message: string} | null};
export type Notification =
  | {method: 'thread/started'; params: {thread: {id: string}}}
  | {method: 'turn/started' | 'turn/completed'; params: {threadId: string; turnId: string; turn: Turn}}
  | {method: 'item/started' | 'item/completed'; params: {threadId: string; turnId: string; item: Item}}
  | {method: 'item/agentMessage/delta'; params: {threadId: string; turnId: string; itemId: string; delta: string}}
  | {method: 'thread/settings/applied'; params: {threadId: string; settings: {model: string}}};

// `model/list` 返回的模型条目（对应 app-server-protocol v2 `Model` 的子集）。
export type Model = {id: string; model: string; displayName: string; description: string; hidden: boolean; isDefault: boolean};
export type ModelListResponse = {data: Model[]; nextCursor: string | null};
export type ConfigReadResponse = {config: {model: string | null; modelProvider: string}};
export type ConfigWriteResponse = {status: 'ok'; version: string; filePath: string};

export interface Client {
  request<T>(method: string, params: unknown): Promise<T>;
  notify(method: string): void;
  subscribe(listener: (event: Notification) => void): () => void;
  onFailure(listener: (error: Error) => void): () => void;
}
