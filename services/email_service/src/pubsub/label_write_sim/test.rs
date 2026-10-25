//! Deterministic races between Macro's Gmail label writes, Gmail's answers
//! and inbox syncs, through the production worker and domain code.

use super::fake_gmail::{Kind, PauseAt, Reply};
use super::sim::{Action, Queue, Sim, Source};
use super::wiring;
use super::world::{INBOX, MESSAGES, STARRED, THREADS, UNREAD, WORK, World, on_worker_stacks};
use sqlx::PgPool;

const T1: usize = 0;
const T2: usize = 1;
const T3: usize = 2;
const M1A: usize = 0;
const M1B: usize = 1;
const M1C: usize = 2;
const M2A: usize = 3;
const M3A: usize = 5;

async fn in_inbox(sim: &Sim<'_>, thread: usize) -> bool {
    sim.world.thread_inbox_visible(THREADS[thread]).await
}

async fn db_has(sim: &Sim<'_>, message: usize, label: &str) -> bool {
    sim.world.db_labels().await[MESSAGES[message].0].contains(label)
}

fn gmail_has(sim: &Sim<'_>, message: usize, label: &str) -> bool {
    sim.world.gmail_labels()[MESSAGES[message].0].contains(label)
}

async fn live_markers(sim: &Sim<'_>) -> usize {
    let ids: Vec<_> = sim.world.message_ids.values().copied().collect();
    wiring::markers(&sim.world.db, &ids)
        .await
        .into_iter()
        .filter(|marker| marker.live)
        .count()
}

async fn sync_thread(sim: &mut Sim<'_>, thread: usize) {
    for (index, (_, thread_id, _)) in MESSAGES.iter().enumerate() {
        if *thread_id == THREADS[thread] {
            sim.sync(index).await;
        }
    }
}

#[sqlx::test(migrator = "macro_db_migrator::MACRO_DB_MIGRATIONS")]
async fn a_rate_limited_archive_survives_sync_and_resync_until_gmail_accepts_it(pool: PgPool) {
    let mut world = World::new(pool, 901).await;
    let sim = &mut Sim::new(&mut world, 1);
    sim.act(Action::Archive(T1, true), false).await.unwrap();
    sim.deliver_all(Queue::Ops, Reply::RateLimited).await;
    assert_eq!(sim.queue_len(Queue::OpsRetry), 1);

    sim.sync(M1A).await;
    sim.resync(M1B).await;
    assert!(gmail_has(sim, M1A, INBOX));
    assert!(!in_inbox(sim, T1).await);
    assert!(!db_has(sim, M1A, INBOX).await);
    assert!(!db_has(sim, M1B, INBOX).await);

    while sim.deliver_from(Queue::OpsRetry, Reply::Ok, false).await {}
    sync_thread(sim, T1).await;
    assert!([M1A, M1B, M1C].iter().all(|m| !gmail_has(sim, *m, INBOX)));
    assert!(!in_inbox(sim, T1).await);
    assert_eq!(live_markers(sim).await, 0);
    assert!(sim.world.flag_mismatches().await.is_empty());
}

#[sqlx::test(migrator = "macro_db_migrator::MACRO_DB_MIGRATIONS")]
async fn an_old_archive_retried_after_a_newer_unarchive_sends_nothing(pool: PgPool) {
    let mut world = World::new(pool, 902).await;
    let sim = &mut Sim::new(&mut world, 1);
    sim.act(Action::Archive(T1, true), false).await.unwrap();
    sim.deliver_all(Queue::Ops, Reply::RateLimited).await;
    sim.act(Action::Archive(T1, false), false).await.unwrap();
    sim.deliver_all(Queue::Ops, Reply::Ok).await;

    let requests_before = sim.world.gmail.lock().log.len();
    while sim.deliver_from(Queue::OpsRetry, Reply::Ok, false).await {}
    assert_eq!(sim.world.gmail.lock().log.len(), requests_before);
    sync_thread(sim, T1).await;
    assert!(gmail_has(sim, M1A, INBOX));
    assert!(in_inbox(sim, T1).await);
}

#[sqlx::test(migrator = "macro_db_migrator::MACRO_DB_MIGRATIONS")]
async fn an_older_star_rejected_after_unstar_and_star_keeps_the_last_star(pool: PgPool) {
    let mut world = World::new(pool, 903).await;
    let sim = &mut Sim::new(&mut world, 1);
    sim.act(Action::Star(T3, true), false).await.unwrap();
    sim.deliver_all(Queue::Ops, Reply::RateLimited).await;
    sim.act(Action::Star(T3, false), false).await.unwrap();
    sim.act(Action::Star(T3, true), false).await.unwrap();
    sim.deliver_all(Queue::Ops, Reply::Ok).await;
    while sim
        .deliver_from(Queue::OpsRetry, Reply::Rejected, false)
        .await
    {}

    sim.sync(M3A).await;
    assert!(db_has(sim, M3A, STARRED).await);
    assert!(gmail_has(sim, M3A, STARRED));
    assert!(sim.world.flag_mismatches().await.is_empty());
}

#[sqlx::test(migrator = "macro_db_migrator::MACRO_DB_MIGRATIONS")]
async fn an_unarchive_that_cannot_be_queued_leaves_the_queued_archive_in_charge(pool: PgPool) {
    let mut world = World::new(pool, 904).await;
    let sim = &mut Sim::new(&mut world, 1);
    sim.act(Action::Archive(T1, true), false).await.unwrap();
    sim.deliver_all(Queue::Ops, Reply::RateLimited).await;
    assert!(sim.act(Action::Archive(T1, false), true).await.is_err());
    assert!(!in_inbox(sim, T1).await);
    assert_eq!(live_markers(sim).await, 3);

    sim.sync(M1A).await;
    sim.resync(M1B).await;
    assert!(!in_inbox(sim, T1).await);
    while sim.deliver_from(Queue::OpsRetry, Reply::Ok, false).await {}
    sync_thread(sim, T1).await;
    assert!(!gmail_has(sim, M1A, INBOX));
    assert!(!in_inbox(sim, T1).await);
}

/// Gmail answers a read before the archive lands, the archive lands and
/// clears its marker, the echo sync runs, and only then does the stale
/// answer arrive.
async fn stale_fetch_after_the_write_lands(sim: &mut Sim<'_>, resync: bool) {
    sim.act(Action::Archive(T1, true), false).await.unwrap();
    sim.deliver_all(Queue::Ops, Reply::RateLimited).await;
    let (source, kind) = if resync {
        (Source::Resync(M1A), Kind::ReadFull)
    } else {
        (Source::Sync(M1A), Kind::ReadLabels)
    };
    let paused = sim
        .start_paused(source, kind, PauseAt::AfterApply)
        .await
        .unwrap();
    while sim.deliver_from(Queue::OpsRetry, Reply::Ok, false).await {}
    sim.sync(M1A).await;
    assert!(!db_has(sim, M1A, INBOX).await);
    sim.finish_paused(paused).await;

    assert!(!db_has(sim, M1A, INBOX).await);
    assert!(!in_inbox(sim, T1).await);
    assert!(!gmail_has(sim, M1A, INBOX));
}

#[sqlx::test(migrator = "macro_db_migrator::MACRO_DB_MIGRATIONS")]
async fn a_stale_label_fetch_does_not_bring_back_an_archive_that_landed_meanwhile(pool: PgPool) {
    let mut world = World::new(pool, 905).await;
    stale_fetch_after_the_write_lands(&mut Sim::new(&mut world, 1), false).await;
}

#[sqlx::test(migrator = "macro_db_migrator::MACRO_DB_MIGRATIONS")]
async fn a_stale_resync_does_not_bring_back_an_archive_that_landed_meanwhile(pool: PgPool) {
    let mut world = World::new(pool, 906).await;
    stale_fetch_after_the_write_lands(&mut Sim::new(&mut world, 1), true).await;
}

#[sqlx::test(migrator = "macro_db_migrator::MACRO_DB_MIGRATIONS")]
async fn a_resync_with_no_gmail_labels_removes_all_but_the_pending_ones(pool: PgPool) {
    let mut world = World::new(pool, 907).await;
    let sim = &mut Sim::new(&mut world, 1);
    sim.act(Action::Read(T3, true), false).await.unwrap();
    sim.deliver_all(Queue::Ops, Reply::RateLimited).await;
    // In Gmail's own UI the user archives, unlabels and reads it.
    sim.world
        .gmail
        .external_change("m3a", &[], &[INBOX, WORK, UNREAD]);

    sim.resync(M3A).await;
    assert!(!db_has(sim, M3A, INBOX).await);
    assert!(!db_has(sim, M3A, WORK).await);
    assert!(!db_has(sim, M3A, UNREAD).await);
    assert!(!in_inbox(sim, T3).await);
    assert!(sim.world.flag_mismatches().await.is_empty());
}

#[sqlx::test(migrator = "macro_db_migrator::MACRO_DB_MIGRATIONS")]
async fn a_rejected_write_restores_the_labels_and_the_thread_state(pool: PgPool) {
    let mut world = World::new(pool, 908).await;
    let sim = &mut Sim::new(&mut world, 1);
    sim.act(Action::Archive(T2, true), false).await.unwrap();
    sim.deliver_all(Queue::Ops, Reply::Rejected).await;
    assert!(db_has(sim, M2A, INBOX).await);
    assert!(in_inbox(sim, T2).await);

    sim.act(Action::Read(T2, true), false).await.unwrap();
    sim.deliver_all(Queue::Ops, Reply::Rejected).await;
    assert!(db_has(sim, M2A, UNREAD).await);
    assert!(sim.world.flag_mismatches().await.is_empty());
}

#[sqlx::test(migrator = "macro_db_migrator::MACRO_DB_MIGRATIONS")]
async fn a_rejected_unarchive_lets_the_older_archive_waiting_behind_it_reach_gmail(pool: PgPool) {
    let mut world = World::new(pool, 909).await;
    let sim = &mut Sim::new(&mut world, 1);
    sim.act(Action::Archive(T3, true), false).await.unwrap();
    sim.deliver_all(Queue::Ops, Reply::RateLimited).await;
    sim.act(Action::Archive(T3, false), false).await.unwrap();
    // The archive's retry runs while the unarchive is still queued: it waits.
    let requests_before = sim.world.gmail.lock().log.len();
    sim.deliver_from(Queue::OpsRetry, Reply::Ok, false).await;
    assert_eq!(sim.world.gmail.lock().log.len(), requests_before);
    assert_eq!(sim.queue_len(Queue::OpsRetry), 1);

    sim.deliver_all(Queue::Ops, Reply::Rejected).await;
    assert!(!in_inbox(sim, T3).await);
    while sim.deliver_from(Queue::OpsRetry, Reply::Ok, false).await {}
    assert!(!gmail_has(sim, M3A, INBOX));
    assert_eq!(live_markers(sim).await, 0);
    sim.sync(M3A).await;
    assert!(!in_inbox(sim, T3).await);
}

#[sqlx::test(migrator = "macro_db_migrator::MACRO_DB_MIGRATIONS")]
async fn a_failed_enqueue_and_a_rejection_keep_the_first_archive_they_took_over(pool: PgPool) {
    let mut world = World::new(pool, 910).await;
    let sim = &mut Sim::new(&mut world, 1);
    sim.act(Action::Archive(T3, true), false).await.unwrap();
    sim.deliver_all(Queue::Ops, Reply::RateLimited).await;
    sim.act(Action::Archive(T3, false), false).await.unwrap();
    assert!(sim.act(Action::Archive(T3, true), true).await.is_err());
    sim.deliver_all(Queue::Ops, Reply::Rejected).await;
    assert!(!in_inbox(sim, T3).await);

    let requests_before = sim.world.gmail.lock().log.len();
    while sim.deliver_from(Queue::OpsRetry, Reply::Ok, false).await {}
    assert!(sim.world.gmail.lock().log.len() > requests_before);
    assert!(!gmail_has(sim, M3A, INBOX));
    sim.sync(M3A).await;
    assert!(!in_inbox(sim, T3).await);
}

/// A star staged, sent and confirmed entirely while a sync's Gmail fetch is
/// in flight.
async fn star_inside_the_fetch(sim: &mut Sim<'_>, resync: bool) {
    let (source, kind) = if resync {
        (Source::Resync(M1A), Kind::ReadFull)
    } else {
        (Source::Sync(M1A), Kind::ReadLabels)
    };
    let paused = sim
        .start_paused(source, kind, PauseAt::AfterApply)
        .await
        .unwrap();
    sim.act(Action::Star(T1, true), false).await.unwrap();
    sim.deliver_all(Queue::Ops, Reply::Ok).await;
    sim.sync(M1A).await;
    assert!(db_has(sim, M1A, STARRED).await);
    sim.finish_paused(paused).await;

    assert!(db_has(sim, M1A, STARRED).await);
    assert!(gmail_has(sim, M1A, STARRED));
    assert!(sim.world.flag_mismatches().await.is_empty());
}

#[sqlx::test(migrator = "macro_db_migrator::MACRO_DB_MIGRATIONS")]
async fn a_resync_keeps_a_write_made_and_confirmed_during_its_fetch(pool: PgPool) {
    let mut world = World::new(pool, 911).await;
    star_inside_the_fetch(&mut Sim::new(&mut world, 1), true).await;
}

#[sqlx::test(migrator = "macro_db_migrator::MACRO_DB_MIGRATIONS")]
async fn a_label_sync_keeps_a_write_made_and_confirmed_during_its_fetch(pool: PgPool) {
    let mut world = World::new(pool, 912).await;
    star_inside_the_fetch(&mut Sim::new(&mut world, 1), false).await;
}

#[sqlx::test(migrator = "macro_db_migrator::MACRO_DB_MIGRATIONS")]
async fn a_recovery_backfill_does_not_bring_back_an_archive_that_landed_during_its_fetch(
    pool: PgPool,
) {
    use models_email::email::service::backfill::{BackfillMessagePayload, JobScopedPayload};
    let mut world = World::new(pool, 913).await;
    let sim = &mut Sim::new(&mut world, 1);
    sim.act(Action::Archive(T1, true), false).await.unwrap();
    sim.deliver_all(Queue::Ops, Reply::RateLimited).await;
    let ctx = sim.world.sync.clone();
    let link = email_db_client::links::get::fetch_link_by_id(&ctx.db, sim.world.link_id)
        .await
        .unwrap()
        .unwrap();
    let scope = JobScopedPayload {
        link_id: link.id,
        job_id: uuid::Uuid::from_u128(0xb0),
        payload: BackfillMessagePayload {
            thread_provider_id: THREADS[T1].to_string(),
            thread_db_id: sim.world.thread_ids[THREADS[T1]],
            message_provider_id: MESSAGES[M1A].0.to_string(),
        },
    };
    wiring::reset_admission(&mut sim.world.redis, sim.world.link_id).await;
    let pause = sim
        .world
        .gmail
        .pause_next(Kind::ReadFull, Some("m1a"), PauseAt::AfterApply);
    let mut backfill = tokio::spawn(async move {
        let _ =
            crate::pubsub::backfill::backfill_message::backfill_message(&ctx, &scope, &link).await;
    });
    let arrived = tokio::select! {
        _ = &mut backfill => false,
        arrived = pause.arrived => arrived.is_ok(),
    };
    assert!(arrived, "the backfill's fetch reaches Gmail");
    while sim.deliver_from(Queue::OpsRetry, Reply::Ok, false).await {}
    sim.sync(M1A).await;
    assert!(!db_has(sim, M1A, INBOX).await);
    let _ = pause.release.send(());
    backfill.await.unwrap();

    assert!(!db_has(sim, M1A, INBOX).await);
    assert!(!gmail_has(sim, M1A, INBOX));
    assert!(sim.world.flag_mismatches().await.is_empty());
}

#[sqlx::test(migrator = "macro_db_migrator::MACRO_DB_MIGRATIONS")]
async fn an_unqueued_mark_unread_reverts_without_undoing_a_newer_mark_read(pool: PgPool) {
    use email::domain::models::mailbox_action::MailboxAction;
    use email::domain::ports::EmailService;
    let mut world = World::new(pool, 914).await;
    let sim = &mut Sim::new(&mut world, 1);
    let (arrived, release) = sim.world.sqs.pause_next_send();
    let owner = super::world::owner();
    let thread = sim.world.thread_ids[THREADS[T1]];
    let email = sim.world.email.clone();
    // Mark t1 unread; its enqueue is held, then fails.
    let first = {
        let email = email.clone();
        let owner = owner.clone();
        tokio::spawn(async move {
            email
                .change_thread_mailbox_state(owner, thread, MailboxAction::Read(false))
                .await
        })
    };
    arrived.await.unwrap();
    // Meanwhile the user marks t1 read; this write is queued normally.
    let second = email
        .change_thread_mailbox_state(owner, thread, MailboxAction::Read(true))
        .await;
    sim.world.sqs.set_outage(true);
    let _ = release.send(());
    let first = first.await.unwrap();
    sim.world.sqs.set_outage(false);

    assert!(first.is_err());
    assert!(second.is_ok());
    for message in [M1A, M1B, M1C] {
        assert!(!db_has(sim, message, UNREAD).await);
    }
    assert!(sim.world.flag_mismatches().await.is_empty());
}

/// Local stacks run the email workers unoptimized on tokio's 2 MiB worker
/// stacks. A label write and a label sync of the same mailbox, run at the same
/// time, must fit well within that: a Gmail read passed by value once made the
/// sync path overflow it.
#[sqlx::test(migrator = "macro_db_migrator::MACRO_DB_MIGRATIONS")]
async fn a_label_write_and_a_label_sync_fit_on_small_worker_stacks(pool: PgPool) {
    use aws_sdk_sqs::types::{Message, MessageSystemAttributeName};
    use email::domain::ports::EmailService;
    use models_email::gmail::inbox_sync::{
        InboxSyncOperation, InboxSyncPubsubMessage, UpdateLabelsPayload,
    };
    let message = |id: String, body: String| {
        Message::builder()
            .receipt_handle(format!("{id}#1"))
            .message_id(id)
            .body(body)
            .attributes(MessageSystemAttributeName::ApproximateReceiveCount, "1")
            .build()
    };
    on_worker_stacks(&pool, 1536 << 10, move |pool| async move {
        let mut world = World::new(pool, 915).await;
        for round in 0..3 {
            world.reset().await;
            world
                .email
                .set_thread_archived(super::world::owner(), world.thread_ids[THREADS[T1]], true)
                .await
                .unwrap();
            let (sent, _) = world.sqs.take();
            let write = sent
                .into_iter()
                .find(|sent| sent.queue_url == world.queues.ops)
                .unwrap()
                .body;
            let label_sync = serde_json::to_string(&InboxSyncPubsubMessage {
                link_id: world.link_id,
                operation: InboxSyncOperation::UpdateLabels(UpdateLabelsPayload {
                    provider_message_id: MESSAGES[M1A].0.to_string(),
                }),
            })
            .unwrap();
            let write = message(format!("write-{round}"), write);
            let label_sync = message(format!("label-sync-{round}"), label_sync);
            let ops = world.ops.clone();
            let sync = world.sync.clone();
            let write = tokio::spawn(async move {
                crate::pubsub::gmail_ops::process::process_message(ops, &write).await
            });
            let label_sync = tokio::spawn(async move {
                crate::pubsub::inbox_sync::process::process_message(sync, &label_sync).await
            });
            write.await.unwrap().unwrap();
            label_sync.await.unwrap().unwrap();
        }
        assert!(!gmail_has_inbox_on_t1(&world));
    });
}

fn gmail_has_inbox_on_t1(world: &World) -> bool {
    let gmail = world.gmail_labels();
    [M1A, M1B, M1C]
        .iter()
        .any(|message| gmail[MESSAGES[*message].0].contains(INBOX))
}
