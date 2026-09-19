use crate::common::{ScriptedModelClient, TestServer};
use anyhow::Result;
use pretty_assertions::assert_eq;
use serde_json::json;

async fn run_turn(server: &mut TestServer, id: i64, thread_id: &str) -> Result<()> {
    server
        .send(json!({"id": id, "method": "turn/start", "params": {"threadId": thread_id, "input": [{"type": "text", "text": "hi"}]}}))
        .await?;
    loop {
        let message = server.recv().await?;
        if message["method"] == "turn/completed" {
            assert_eq!(message["params"]["turn"]["status"], "completed");
            return Ok(());
        }
    }
}

#[tokio::test]
async fn thread_settings_update_changes_model_for_following_turns() -> Result<()> {
    tokio::time::timeout(std::time::Duration::from_secs(5), async {
        let model = ScriptedModelClient::echo();
        let mut server =
            TestServer::start(model.clone(), "model = \"deepseek-flash\"\n").await?;
        let thread_id = server.start_thread(1).await?;

        run_turn(&mut server, 2, &thread_id).await?;

        let (response, notifications) = server
            .request(3, "thread/settings/update", json!({"threadId": thread_id, "model": "deepseek-v4-pro"}))
            .await?;
        assert_eq!(response, json!({"id": 3, "result": {}}));
        // 应用成功的通知可能先于响应到达，也可能之后到达。
        let applied = if notifications.is_empty() {
            server.recv().await?
        } else {
            notifications[0].clone()
        };
        assert_eq!(
            applied,
            json!({"method": "thread/settings/applied", "params": {"threadId": thread_id, "settings": {"model": "deepseek-v4-pro"}}})
        );

        run_turn(&mut server, 4, &thread_id).await?;

        // 空更新不触发 core 操作，但仍返回成功。
        let (response, notifications) = server
            .request(5, "thread/settings/update", json!({"threadId": thread_id}))
            .await?;
        assert_eq!(response, json!({"id": 5, "result": {}}));
        assert!(notifications.is_empty());

        let (response, _) = server
            .request(6, "thread/settings/update", json!({"threadId": "missing", "model": "x"}))
            .await?;
        assert_eq!(response, json!({"id": 6, "error": {"code": -32602, "message": "Thread not found"}}));

        server.shutdown().await?;
        assert_eq!(
            *model.models.lock().unwrap(),
            vec!["deepseek-flash".to_string(), "deepseek-v4-pro".to_string()]
        );
        Ok::<(), anyhow::Error>(())
    })
    .await??;
    Ok(())
}
