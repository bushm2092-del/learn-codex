# 7. config.toml：模型与 provider 从哪里来

前六节里，模型名、服务地址和密钥都由入口硬编码或读环境变量。真实 Codex 不这样做：
它把“用哪个模型、访问哪个 provider、密钥放在哪个环境变量里”统一写进 `config.toml`，
再由 core 把文件内容和运行期覆盖合并成一个 `Config`。本节按源项目的结构移植这条链。

## 数据先行：config.toml 长什么样

```toml
model = "deepseek-v4-pro"
model_provider = "deepseek"

[model_providers.deepseek]
name = "DeepSeek"
base_url = "https://api.deepseek.com"
env_key = "DEEPSEEK_API_KEY"
env_key_instructions = "在 https://platform.deepseek.com 创建密钥后 export DEEPSEEK_API_KEY=..."
```

这个文件是可选的：`deepseek` 是内建 provider，默认模型来自打包的模型目录
（`crates/models-manager/models.json`，默认 `deepseek-flash`）。

密钥放在同目录的 `.env`：

```text
~/.mini-codex/
├── config.toml   # 模型、provider 定义（可选，从不存密钥）
└── .env          # DEEPSEEK_API_KEY=...（启动时由 crates/arg0 自动加载）
```

这与 Codex 的 `~/.codex/{config.toml,.env}` 一一对应：`codex-rs/arg0/src/lib.rs::load_dotenv`
在创建任何线程之前读取 `$CODEX_HOME/.env`，并拒绝以 `CODEX_` 开头的键，防止配置文件劫持
`CODEX_HOME` 等控制变量。本项目的 `crates/arg0` 同样处理，前缀改为 `MINI_CODEX_`。

三个字段各管一件事：

| 字段 | 含义 |
| --- | --- |
| `model` | 请求体里的 `model` |
| `model_provider` | 从 `model_providers` 表中选中的键 |
| `[model_providers.<id>]` | 该 provider 的 `base_url`、`env_key`、`wire_api` 等 |

密钥本身不在文件里。`env_key` 只说明“去读哪个环境变量”，读取动作发生在
`ModelProviderInfo::api_key()`。这与 Codex 对第三方 provider 的处理完全一致。Codex 内建的
`openai` provider 走 auth.json 登录，本项目按用户要求取消了它，只保留 `env_key` 一条路径。

文件位置是 `$MINI_CODEX_HOME/config.toml`，默认 `~/.mini-codex/config.toml`。
源项目用 `CODEX_HOME` / `~/.codex`；本项目改名是为了不覆盖同一台机器上真实 Codex 的配置。

## 边界：四个 crate 各负责一段

```text
codex-rs/arg0                    -> crates/arg0                    启动时加载 .env
codex-rs/utils/home-dir          -> crates/utils/home-dir          定位配置目录
codex-rs/model-provider-info     -> crates/model-provider-info     ModelProviderInfo、内建 provider
codex-rs/models-manager          -> crates/models-manager          models.json 模型目录、默认模型
codex-rs/config                  -> crates/config                  ConfigToml、分层加载、TOML 合并
codex-rs/core/src/config/mod.rs  -> crates/core/src/config/mod.rs  Config、ConfigOverrides、最终合并
```

依赖方向是 `protocol -> model-provider-info / models-manager -> config -> core -> cli / app-server`。
`config` crate 只回答“文件里写了什么”，不知道默认 provider 是谁；`core::config` 才回答“最终生效的是什么”。

## 循环：一次加载经过哪些函数

```text
arg0::load_dotenv()                 先于 Tokio 运行时，把 ~/.mini-codex/.env 写入进程环境
find_codex_home()
  -> load_config_as_toml_with_cli_overrides(codex_home, cli_overrides)
       -> loader::load_config_layers_state      读 user 层，叠加 -c 覆盖层（SessionFlags）
       -> ConfigLayerStack::effective_config    merge_toml_values 逐层合并
       -> deserialize_config_toml_with_base     TomlValue -> ConfigToml
  -> Config::load_from_base_config_with_overrides(cfg, overrides, codex_home)
       -> built_in_model_providers + merge_configured_model_providers
       -> model_provider = overrides.model_provider.or(cfg.model_provider).unwrap_or("deepseek")
       -> model = overrides.model.or(cfg.model)          仍是 Option，留给 ThreadManager 决定默认
       -> cwd 相对路径相对当前目录解析
  -> OpenAiResponsesClient::from_config(&config)
       -> provider.api_key()?  缺变量时报 EnvVarError，附带 env_key_instructions
  -> ThreadManager::new(config, client, tools, instructions)
       -> default_model() = config.model.or(ModelsManager::get_default_model())
```

优先级与源项目一致：harness 覆盖 > `-c` 运行期覆盖 > `config.toml` > 默认值。
source 位于 `crates/core/src/config/mod.rs`，逐行对照 `codex-rs/core/src/config/mod.rs`
中 `load_config_with_layer_stack` 的 provider 与 model 解析段落。

入口只剩一件事：

```rust
let config = Config::load_with_cli_overrides_and_harness_overrides(
    Vec::new(),
    ConfigOverrides { cwd: Some(env::current_dir()?), ..Default::default() },
)?;
let client = Arc::new(OpenAiResponsesClient::from_config(&config)?);
let manager = ThreadManager::new(config, client, tools, instructions);
```

`cli/src/main.rs` 和 `app-server/src/lib.rs` 都是这三行，不再各自读环境变量。

## 测试：证明数据没有在中途变形

| 测试文件 | 覆盖的可观察行为 |
| --- | --- |
| `crates/arg0/src/lib.rs` | `.env` 中普通键被写入；`MINI_CODEX_` 前缀（含小写）被忽略；文件缺失静默跳过 |
| `crates/utils/home-dir/src/lib.rs` | `MINI_CODEX_HOME` 不存在/不是目录时报错；默认落到 `~/.mini-codex` |
| `crates/model-provider-info/src/model_provider_info_tests.rs` | TOML 反序列化；`wire_api = "chat"` 给出迁移提示；`api_key()` 缺变量时的错误文案 |
| `crates/config/src/loader/tests.rs` | 文件缺失得到空层；`-c` 覆盖成为最高层；TOML 语法错误报告文件路径 |
| `crates/models-manager/src/manager_tests.rs` | 目录按优先级排序、隐藏项不进选择器、默认模型为 `deepseek-flash` |
| `crates/core/src/config/config_tests.rs` | 默认 `deepseek` provider；覆盖项优先于文件；未知 provider 报 `NotFound` |
| `mini-codex-tui/test/client.test.ts` | 真实 app-server 进程从临时 `MINI_CODEX_HOME` 读取配置并完成一次工具往返 |

## 与源项目的差异

- 只加载 user 层和 SessionFlags 层；packaged defaults、system、MDM、enterprise、project 层与
  requirements 约束未移植。
- `AbsolutePathBuf` 简化为 `PathBuf`，loader 用 `std::fs` 同步读取而非 `ExecutorFileSystem`。
- `ModelProviderInfo` 只保留 `name`、`base_url`、`env_key`、`env_key_instructions`、`wire_api`；
  重试、超时、HTTP 头、Bedrock 等字段未移植。
- 按用户要求取消官方 `openai` provider、auth.json 与 `requires_openai_auth`，内建 provider 只有 `deepseek`。
- 模型目录是打包的静态 `models.json`（源项目会在线刷新 OpenAI 目录）。

下一节看模型如何在运行中切换：[`/model` 与 thread settings](./08-model-selection)。
