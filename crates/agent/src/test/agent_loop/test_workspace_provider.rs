//! Workspace routing over a real local OpenAI-compatible HTTP endpoint.
use super::util;
use crate::{ModelRouter, StreamPart};
use ai_toolset::AsyncToolCollection;
use serde_json::{Value, json};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::oneshot;

async fn endpoint(response: String) -> (String, oneshot::Receiver<(String, Value)>) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}/v1", listener.local_addr().unwrap());
    let (tx, rx) = oneshot::channel();
    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut bytes = Vec::new();
        let (headers, body) = loop {
            let mut chunk = [0; 8192];
            let count = socket.read(&mut chunk).await.unwrap();
            assert_ne!(count, 0);
            bytes.extend_from_slice(&chunk[..count]);
            assert!(bytes.len() < 262_144);
            if let Some(boundary) = bytes.windows(4).position(|window| window == b"\r\n\r\n") {
                let headers = String::from_utf8(bytes[..boundary].to_vec()).unwrap();
                let length: usize = headers
                    .lines()
                    .find_map(|line| {
                        let (name, value) = line.split_once(':')?;
                        name.eq_ignore_ascii_case("content-length")
                            .then(|| value.trim().parse().unwrap())
                    })
                    .unwrap();
                if bytes.len() >= boundary + 4 + length {
                    break (
                        headers,
                        serde_json::from_slice(&bytes[boundary + 4..boundary + 4 + length])
                            .unwrap(),
                    );
                }
            }
        };
        socket.write_all(response.as_bytes()).await.unwrap();
        socket.shutdown().await.unwrap();
        tx.send((headers, body)).unwrap();
    });
    (base, rx)
}

fn reply(status: &str, body: &str) -> String {
    format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )
}

#[tokio::test]
async fn custom_and_keyless_models_stream_without_initializing_cloud_clients() {
    for key in ["", "private-workspace-test-key"] {
        let body = [
            json!({"id":"local-1", "object":"chat.completion.chunk", "created":0, "model":"local/model", "choices":[{"index":0, "delta":{"role":"assistant", "content":"Local answer"}, "finish_reason":null}]}),
            json!({"id":"local-1", "object":"chat.completion.chunk", "created":0, "model":"local/model", "choices":[{"index":0, "delta":{}, "finish_reason":"stop"}], "usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8}}),
        ].iter().map(|event| format!("data: {event}\n\n")).collect::<String>() + "data: [DONE]\n\n";
        let (base, request) = endpoint(reply("200 OK", &body)).await;
        let router =
            ModelRouter::openai_compatible("workspace-test", &base, key, reqwest::Client::new())
                .unwrap();
        let mut session = util::test_loop()
            .with_router(Some(Arc::new(router)))
            .with_model("workspace-test/local/model")
            .with_genai_telemetry(false)
            .session(
                util::tool_set(AsyncToolCollection::<()>::new()),
                Arc::new(()),
                "Answer locally",
                util::usage_ctx(),
            )
            .await;
        let collected = tokio::time::timeout(
            std::time::Duration::from_secs(10),
            util::drive(&mut session, "hello"),
        )
        .await
        .unwrap();
        assert!(collected.error.is_none(), "{:?}", collected.error);
        assert!(
            collected
                .parts
                .iter()
                .any(|part| matches!(part, StreamPart::Content(text) if text == "Local answer"))
        );
        let (headers, body) = request.await.unwrap();
        assert!(headers.starts_with("POST /v1/chat/completions "));
        assert_eq!(body["model"], "local/model");
        if !key.is_empty() {
            assert!(headers.contains(&format!("Bearer {key}")));
        }
    }
}

#[tokio::test]
async fn an_endpoint_error_never_returns_the_saved_credential_to_the_session() {
    let secret = "private-workspace-key-echoed-by-endpoint";
    let (base, request) = endpoint(reply("401 Unauthorized", secret)).await;
    let router =
        ModelRouter::openai_compatible("workspace-test", &base, secret, reqwest::Client::new())
            .unwrap();
    let mut session = util::test_loop()
        .with_router(Some(Arc::new(router)))
        .with_model("workspace-test/local")
        .with_genai_telemetry(false)
        .session(
            util::tool_set(AsyncToolCollection::<()>::new()),
            Arc::new(()),
            "Answer locally",
            util::usage_ctx(),
        )
        .await;
    let collected = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        util::drive(&mut session, "hello"),
    )
    .await
    .unwrap();
    let error = collected.error.unwrap();
    assert!(!format!("{error:?}").contains(secret));
    assert!(error.to_string().contains("Workspace model request failed"));
    request.await.unwrap();
}
