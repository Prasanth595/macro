use super::*;

fn client() -> RedisClient {
    RedisClient::new(redis::Client::open("redis://127.0.0.1:6379/").unwrap(), 60)
}

/// A slot set of its own, so tests never touch the fleet's slots or each other's.
fn unique_key() -> String {
    format!("test:email:backfill:write_slots:{}", Uuid::now_v7())
}

fn slots(key: &str, capacity: u32) -> SlotSet<'_> {
    SlotSet {
        key,
        capacity,
        lease: LEASE,
        wait: Duration::ZERO,
    }
}

async fn cleanup(client: &RedisClient, key: &str) {
    let mut connection = client
        .inner
        .get_multiplexed_async_connection()
        .await
        .unwrap();
    let _: i32 = redis::cmd("DEL")
        .arg(key)
        .query_async(&mut connection)
        .await
        .unwrap();
}

#[tokio::test]
async fn writes_beyond_capacity_are_refused_until_a_slot_is_released() {
    let client = client();
    let key = unique_key();
    let slots = slots(&key, 2);

    let first = client
        .acquire_write_slot(&slots)
        .await
        .unwrap()
        .expect("the first write gets a slot");
    let second = client
        .acquire_write_slot(&slots)
        .await
        .unwrap()
        .expect("the second write gets a slot");
    assert!(
        client.acquire_write_slot(&slots).await.unwrap().is_none(),
        "a third concurrent write must wait"
    );

    first.release().await;
    let third = client
        .acquire_write_slot(&slots)
        .await
        .unwrap()
        .expect("a released slot admits the next write");

    second.release().await;
    third.release().await;
    cleanup(&client, &key).await;
}

#[tokio::test]
async fn a_crashed_writers_expired_lease_frees_its_slot() {
    let client = client();
    let key = unique_key();
    let mut connection = client
        .inner
        .get_multiplexed_async_connection()
        .await
        .unwrap();
    // A lease that expired long ago, as left by a worker that died holding it.
    let _: i32 = redis::cmd("ZADD")
        .arg(&key)
        .arg(1)
        .arg("crashed-writer")
        .query_async(&mut connection)
        .await
        .unwrap();

    let slot = client
        .acquire_write_slot(&slots(&key, 1))
        .await
        .unwrap()
        .expect("an expired lease does not hold the only slot");

    slot.release().await;
    cleanup(&client, &key).await;
}
