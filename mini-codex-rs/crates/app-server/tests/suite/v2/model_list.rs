use crate::common::{ScriptedModelClient, TestServer};
use anyhow::Result;
use pretty_assertions::assert_eq;
use serde_json::json;

#[tokio::test]
async fn model_list_returns_visible_models_and_paginates() -> Result<()> {
    tokio::time::timeout(std::time::Duration::from_secs(5), async {
        let mut server = TestServer::start(ScriptedModelClient::echo(), "").await?;

        let (response, _) = server.request(1, "model/list", json!({})).await?;
        assert_eq!(
            response["result"],
            json!({
                "data": [
                    {"id": "deepseek-flash", "model": "deepseek-flash", "displayName": "DeepSeek V4.1 Flash", "description": "默认模型：速度快、成本低，支持工具调用与 Responses API。", "hidden": false, "isDefault": true},
                    {"id": "deepseek-v4-pro", "model": "deepseek-v4-pro", "displayName": "DeepSeek V4 Pro", "description": "能力更强的旗舰模型，适合复杂任务。", "hidden": false, "isDefault": false}
                ],
                "nextCursor": null
            })
        );

        let (response, _) = server
            .request(2, "model/list", json!({"limit": 1, "includeHidden": true}))
            .await?;
        assert_eq!(response["result"]["data"].as_array().unwrap().len(), 1);
        assert_eq!(response["result"]["nextCursor"], "1");
        let (response, _) = server
            .request(3, "model/list", json!({"limit": 5, "cursor": "1", "includeHidden": true}))
            .await?;
        assert_eq!(
            response["result"]["data"]
                .as_array()
                .unwrap()
                .iter()
                .map(|model| model["model"].as_str().unwrap())
                .collect::<Vec<_>>(),
            vec!["deepseek-v4-pro", "deepseek-v4-flash"]
        );
        assert_eq!(response["result"]["nextCursor"], serde_json::Value::Null);

        let (response, _) = server
            .request(4, "model/list", json!({"cursor": "abc"}))
            .await?;
        assert_eq!(
            response,
            json!({"id": 4, "error": {"code": -32602, "message": "invalid cursor: abc"}})
        );
        server.shutdown().await
    })
    .await??;
    Ok(())
}
