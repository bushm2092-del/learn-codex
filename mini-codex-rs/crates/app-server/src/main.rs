fn main() -> anyhow::Result<()> {
    // 修改环境变量不是线程安全的，必须在创建 Tokio 运行时之前完成。
    mini_codex_arg0::load_dotenv();
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?
        .block_on(mini_codex_app_server::run_main())
}
