# 工具曝光策略与延迟发现

源码基准：`/Users/hfh/Desktop/github/codex`，提交 `53446f90a5`。
本文描述 mini-codex **实际移植的子集**，不把 MCP、Code Mode 或外部 provider 的能力当成已实现。

## 注册、曝光、权限是三件事

`ToolRegistry` 保存 `ToolName → RegisteredTool`，后者含 runtime 与 exposure。
`ToolExecutor::exposure()` 默认 Direct，宿主也能使用 `register_trusted_with_exposure`
覆盖运行实例的曝光方式。

| 曝光类型 | 初始模型 tools | 搜索索引 | 注册表保留实现 |
| --- | --- | --- | --- |
| Direct | 是 | 否 | 是 |
| Deferred | 否 | 是 | 是 |
| Hidden | 否 | 否 | 是 |

Hidden 只控制曝光，不是调用授权。知道名字的调用仍会进入注册表分派。
搜索工具也不会执行所找到的业务工具，只返回使用说明。
shell 的 cwd、命令解析与执行边界未改变；没有增加 sandbox 或审批保障。

## 组装顺序

`ThreadManager` 注册具体工具后调用 `spec_plan::finalize_tool_router`。
它先检查模型和 provider 能力，再确认注册表存在可搜索的 Deferred 工具。
条件满足时由 `ToolSearchHandlerCache` 建立或复用搜索实现，注册 `tool_search`。
最后按注册顺序收集 Direct 规格，合并 namespace、过滤 provider 不支持的 namespace，
构造 `ToolRouter`。模型可见列表不再由 ThreadManager 另外手动维护。

原生搜索的条件与源项目保持同一逻辑：

```rust
model_info.supports_search_tool && provider.namespace_tools
```

当前默认 DeepSeek 未声明这些能力，所以默认入口不会发送原生工具搜索。
不要只因为一个接口支持 `/responses`，就把所有 Responses 工具类型都当作已支持。
本次没有新增自定义配置开关，也没有把 `exec_command` 改成延迟工具。

## 元数据与 BM25

`ToolExecutor::search_info()` 从 spec 派生 `ToolSearchInfo`。
函数索引依次收集名字、将下划线替换为空格的名字、描述，再递归收集 schema 的
description、properties、items、anyOf。schema 沿用本项目的 serde_json::Value，遍历顺序
对照上游 JsonSchema 实现。搜索采用 `bm25 = 2.3.2`、`Language::English`，不是自制子串匹配；
不保证中文分词效果，未增加不同于上游的分词器。

`ToolSearchHandlerCache` 只收集 Deferred 运行实例：不可变规格使用 Weak 身份比较，
动态元数据按值比较；元数据与来源展示模式不变时复用索引，否则重建。
目前内建工具没有覆盖 immutable_spec，实际主要走动态元数据分支。

选中的函数规格被规范化为默认 `functions` namespace；子工具标记
`defer_loading: true`，移除宿主 output_schema。相同 namespace 的结果按搜索返回顺序合并。
这与直接模型列表中 namespace 子工具按名字排序是两处不同逻辑。

## 原生协议链路

模型返回的搜索项不是普通 function_call：

```json
{
  "type": "tool_search_call",
  "call_id": "search-1",
  "execution": "client",
  "arguments": {"query": "calendar", "limit": 1}
}
```

`ToolRouter::build_tool_call` 只接管 execution=client 且有 call_id 的搜索。
arguments 解析为 `SearchToolCallParams`，包装进 `ToolPayload::ToolSearch`，随后沿既有
ToolCallRuntime → ToolRegistry → ToolSearchHandler 路径执行。handler 支持并行。
query 去除两端空白后不能为空；limit 默认 8，不能为 0。按上游行为不另加最大值。

结果通过 `ToolSearchOutput::to_response_item` 回传：

```json
{
  "type": "tool_search_output",
  "call_id": "search-1",
  "status": "completed",
  "execution": "client",
  "tools": [{
    "type": "namespace",
    "name": "functions",
    "description": "",
    "tools": [{
      "type": "function",
      "name": "calendar_lookup",
      "description": "查询日程（测试工具示意，不是内建工具）",
      "strict": false,
      "defer_loading": true,
      "parameters": {"type": "object", "properties": {}}
    }]
  }]
}
```

turn loop 先记录模型搜索调用，再记录输出；下一次请求的 input 带上这些历史项。
初始工具规格列表不因搜索而永久膨胀。模型随后生成普通 function_call，注册表执行
已经注册的工具。当前没有历史压缩，不能将这一实现理解成完整的压缩后工具可见性管理。

空查询、limit=0 会产生 RespondToModel；运行时按源项目的搜索专用失败路径回传
空 tools 数组、status=completed，而不是 function_call_output。失败事件仍带错误信息。
没有匹配的正常搜索也返回空数组。参数形状解析错误在 router 返回 RespondToModel；
沿本项目既有简化 turn 分支结束回合，尚未移植上游 stream_events_utils 的完整错误恢复。

## 源码映射与显式删减

下列源路径相对于 `codex-rs/`，目标统一为 `mini-codex-rs/crates/` 加相同路径：

| 源路径 | 保留内容 |
| --- | --- |
| `tools/src/tool_executor.rs` | ToolExposure、exposure、search_info |
| `tools/src/responses_api.rs` | 函数/namespace/可加载规格、结果合并 |
| `tools/src/tool_spec.rs` | Function、Namespace、ToolSearch |
| `tools/src/tool_discovery.rs` | 搜索名称、默认数量、来源类型 |
| `tools/src/tool_search.rs` | 元数据遍历与规格规范化 |
| `protocol/src/models.rs` | ToolSearchCall、ToolSearchOutput、SearchToolCallParams |
| `protocol/src/openai_models.rs` | supports_search_tool |
| `model-provider/src/provider.rs` | ProviderCapabilities.namespace_tools |
| `core/src/tools/spec_plan.rs` | 搜索注册条件、可见规格生成、namespace 合并 |
| `core/src/tools/handlers/tool_search.rs` | 缓存、BM25 建索引/查询、参数校验 |
| `core/src/tools/handlers/tool_search_spec.rs` | 原生搜索规格的 Omit 分支 |
| `core/src/tools/{router,registry,parallel,context}.rs` | 搜索分派、专用结果与错误回传 |

明确未移植/偏离的部分：

- 删除 Code Mode、Custom、WebSearch、MCP、插件安装、外部扩展、间接 namespace 描述前缀。
  ToolExposure 仅保留 Direct、Deferred、Hidden，不承诺其他曝光表面。
- 无 MCP 来源目录，source listing 只保留 Omit；上游默认搜索描述保留用于源码对照，
  其中提及 MCP 不表示本项目实现了 MCP。
- 保留现有 Value schema 表示，未引入完整 JsonSchema / ToolOutputSchema 类型。
  ResponsesApiTool 从本项目旧 tool_spec.rs 移到上游对应 responses_api.rs，公开重导出不变。
- `finalize_tool_router` 参数缩减为模型信息、provider 能力、registry 和缓存；本项目没有
  StepContext，因此工具方案仍在线程管理器构造时建立，不实现逐步骤策略重建。
- ProviderCapabilities 只保留 namespace_tools，不移植认证/provider 生命周期；默认入口
  保守传 false，未知模型目录回退也不会开启搜索。这是显式的 DeepSeek 安全兼容选择，
  不是上游全功能 provider 的默认值。
- 保留原项目已有的重复注册 assert 行为，未移植 configurable collision policy、hooks、
  ToolPolicy、审批、取消、遥测和历史 envelope。新增搜索保留名冲突也会失败，不覆盖已有实现。
- CoreToolRuntime 暂保留本项目 blanket impl，仅补 immutable_spec 默认方法；没有完整宿主扩展接口。
- 测试使用原生协议 mock 模型与测试工具；无真实 API 调用或 API Key 需求。

## 验证与学习入口

```bash
cd mini-codex-rs
cargo test -p mini-codex-core tools::spec_plan
cargo test -p mini-codex-tools
cargo test -p mini-codex-core normalizes_native_tool_search_item
```

`core/src/tools/spec_plan_tests.rs` 包含三轮模型闭环：搜索、执行发现的工具、完成回答；
同时检查隐藏/直接工具不入搜索、模型/provider 能力门、无匹配、空查询、零 limit、缓存复用。
`tools/src/tool_search_tests.rs` 检查嵌套 schema 索引、规范化和同 namespace 合并。
SSE 解析测试确认搜索调用不会落入 Other。

这项能力适合对照源码讲解和离线测试。真实服务商的原生搜索能力确认与生产启用是后续工作，
不能将 mock 成功描述为 DeepSeek 线上验证成功。
