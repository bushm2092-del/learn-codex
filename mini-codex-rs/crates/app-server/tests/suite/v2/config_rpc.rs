use crate::common::{ScriptedModelClient, TestServer};
use anyhow::Result;
use pretty_assertions::assert_eq;
use serde_json::json;

#[tokio::test]
async fn config_read_and_value_write_round_trip_through_config_toml() -> Result<()> {
    tokio::time::timeout(std::time::Duration::from_secs(5), async {
        let mut server = TestServer::start(
            ScriptedModelClient::echo(),
            "# 注释保留\nmodel = \"deepseek-flash\"\n",
        )
        .await?;
        let config_path = server.codex_home.path().join("config.toml");

        let (response, _) = server.request(1, "config/read", json!({})).await?;
        assert_eq!(
            response["result"],
            json!({"config": {"model": "deepseek-flash", "modelProvider": "deepseek"}})
        );

        let (response, _) = server
            .request(
                2,
                "config/value/write",
                json!({"keyPath": "model", "value": "deepseek-v4-pro", "mergeStrategy": "replace"}),
            )
            .await?;
        assert_eq!(response["result"]["status"], "ok");
        assert_eq!(
            response["result"]["filePath"],
            config_path.display().to_string()
        );
        assert!(
            response["result"]["version"]
                .as_str()
                .unwrap()
                .starts_with("sha256:")
        );
        assert_eq!(
            std::fs::read_to_string(&config_path)?,
            "# 注释保留\nmodel = \"deepseek-v4-pro\"\n"
        );

        let (response, _) = server.request(3, "config/read", json!({})).await?;
        assert_eq!(response["result"]["config"]["model"], "deepseek-v4-pro");

        let (response, _) = server
            .request(
                4,
                "config/value/write",
                json!({"keyPath": "", "value": "x", "mergeStrategy": "replace"}),
            )
            .await?;
        assert_eq!(
            response,
            json!({"id": 4, "error": {"code": -32602, "message": "keyPath must not be empty"}})
        );
        server.shutdown().await
    })
    .await??;
    Ok(())
}

#[tokio::test]
async fn config_read_falls_back_to_default_model_when_unset() -> Result<()> {
    tokio::time::timeout(std::time::Duration::from_secs(5), async {
        let mut server = TestServer::start(ScriptedModelClient::echo(), "").await?;
        let (response, _) = server.request(1, "config/read", json!({})).await?;
        assert_eq!(
            response["result"],
            json!({"config": {"model": "deepseek-flash", "modelProvider": "deepseek"}})
        );
        server.shutdown().await
    })
    .await??;
    Ok(())
}
