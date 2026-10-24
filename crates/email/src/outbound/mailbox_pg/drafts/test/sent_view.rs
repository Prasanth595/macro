use super::*;
use crate::domain::models::{PreviewCursorQuery, PreviewView, PreviewViewStandardLabel};
use macro_user_id::user_id::MacroUserIdStr;
use models_pagination::{Query, SimpleSortMethod};

async fn sent_threads(repo: &EmailPgRepo, link: Uuid) -> Vec<Uuid> {
    repo.previews_for_view_cursor(
        PreviewCursorQuery {
            view: PreviewView::StandardLabel(PreviewViewStandardLabel::Sent),
            link_ids: vec![link],
            limit: 50,
            query: Query::new(None, SimpleSortMethod::UpdatedAt, None),
            team_id: None,
        },
        MacroUserIdStr::parse_from_str(ACTOR).unwrap().to_owned(),
    )
    .await
    .unwrap()
    .into_iter()
    .map(|preview| preview.id)
    .collect()
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn a_confirmed_outlook_send_is_in_sent_before_the_provider_copy_syncs(db: PgPool) {
    let (sync, repo, input, link) = setup(&db, true).await;
    let lease = sync
        .claim_draft(
            Uuid::now_v7(),
            crate::domain::mailbox::drafts::models::DraftClaimMode::All,
        )
        .await
        .unwrap()
        .unwrap();
    let mut cp = checkpoint(&lease, DraftStage::Confirming);
    cp.draft.as_mut().unwrap().is_draft = false;
    sync.confirm_sent(&lease, &cp).await.unwrap();
    assert_eq!(sent_threads(&repo, link).await, vec![input.thread_db_id]);

    let work = sync.claim_message(Uuid::now_v7()).await.unwrap().unwrap();
    let mut remote = snapshot(link, "a", MailboxState::default(), "v2");
    remote.content.message.is_sent = true;
    sync.ingest(&work, remote).await.unwrap();
    let outbound = sqlx::query_scalar!(
        "SELECT latest_outbound_message_ts FROM email_threads WHERE id = $1",
        input.thread_db_id
    )
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(
        outbound.map(|ts| ts.to_rfc3339()).as_deref(),
        Some("2026-10-01T12:00:00+00:00"),
        "the provider's sent time replaces the provisional one"
    );
    assert_eq!(sent_threads(&repo, link).await, vec![input.thread_db_id]);
}
