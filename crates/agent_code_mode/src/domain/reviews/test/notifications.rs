use super::*;

#[tokio::test]
async fn presenting_a_review_tells_its_account_holder_once() {
    let f = Fixture::new();
    let row = f.create(vec![json!({"subject":"x"})]).await;
    f.service.read(&f.view(), row.id).await.unwrap();
    assert_eq!(
        f.told(1).await,
        vec![Told::Awaiting(f.actions.owner.to_string(), row.id)]
    );
}

#[tokio::test]
async fn an_unpresented_review_tells_nobody_until_its_presentation_is_retried() {
    let f = Fixture::new();
    f.actions.fail_presentation.store(true, Ordering::SeqCst);
    assert!(
        f.service
            .create(
                &f.edit(),
                &f.actions.owner,
                f.input(vec![json!({"subject":"x"})])
            )
            .await
            .is_err()
    );
    assert!(f.notifier.told.lock().unwrap().is_empty());
    let row = f.store.0.lock().unwrap().values().next().unwrap().clone();
    f.actions.fail_presentation.store(false, Ordering::SeqCst);
    f.service.read(&f.view(), row.id).await.unwrap();
    assert_eq!(
        f.told(1).await,
        vec![Told::Awaiting(f.actions.owner.to_string(), row.id)]
    );
}

#[tokio::test]
async fn a_requesters_review_tells_the_requester_not_the_owner() {
    let f = Fixture::new();
    let requester = MacroUserIdStr::try_from_email("requester@example.com").unwrap();
    let access = EntityAccessReceipt::dangerously_assert_authenticated_user(
        requester.clone(),
        &f.session.to_string(),
        EntityType::AgentSession,
    );
    let row = f
        .service
        .create(
            &access,
            &requester,
            f.input(vec![json!({"subject":"requester draft"})]),
        )
        .await
        .unwrap();
    f.service
        .decide(
            &access,
            &requester,
            row.id,
            ReviewDecision::Dismiss {
                revision: row.revision,
                items: vec![],
            },
        )
        .await
        .unwrap();
    assert_eq!(
        f.told(2).await,
        vec![
            Told::Awaiting(requester.to_string(), row.id),
            Told::Resolved(requester.to_string(), row.id),
        ]
    );
}

#[tokio::test]
async fn edits_and_partial_dismissals_leave_the_review_awaiting() {
    let f = Fixture::new();
    let row = f
        .create(vec![json!({"subject":"one"}), json!({"subject":"two"})])
        .await;
    let edited = f
        .service
        .decide(
            &f.edit(),
            &f.actions.owner,
            row.id,
            ReviewDecision::Edit {
                revision: row.revision,
                item: row.items[0].id,
                draft: json!({"subject":"edited"}),
            },
        )
        .await
        .unwrap();
    let partly_dismissed = f
        .service
        .decide(
            &f.edit(),
            &f.actions.owner,
            row.id,
            ReviewDecision::Dismiss {
                revision: edited.revision,
                items: vec![row.items[0].id],
            },
        )
        .await
        .unwrap();
    assert_eq!(
        *f.notifier.told.lock().unwrap(),
        vec![Told::Awaiting(f.actions.owner.to_string(), row.id)]
    );
    f.service
        .decide(
            &f.edit(),
            &f.actions.owner,
            row.id,
            ReviewDecision::Dismiss {
                revision: partly_dismissed.revision,
                items: vec![],
            },
        )
        .await
        .unwrap();
    assert_eq!(
        f.told(2).await[1],
        Told::Resolved(f.actions.owner.to_string(), row.id)
    );
}

#[tokio::test]
async fn a_submitted_review_resolves_once_its_last_action_settles() {
    let f = Fixture::new();
    f.actions.block_actions.store(true, Ordering::SeqCst);
    let row = f
        .create(vec![json!({"subject":"one"}), json!({"subject":"two"})])
        .await;
    f.service
        .decide(
            &f.edit(),
            &f.actions.owner,
            row.id,
            ReviewDecision::Submit {
                revision: row.revision,
                items: vec![],
            },
        )
        .await
        .unwrap();
    f.actions.action_started.notified().await;
    assert_eq!(f.notifier.told.lock().unwrap().len(), 1);
    f.actions.action_gate.notify_one();
    f.actions.action_started.notified().await;
    f.actions.action_gate.notify_one();
    assert_eq!(
        f.told(2).await,
        vec![
            Told::Awaiting(f.actions.owner.to_string(), row.id),
            Told::Resolved(f.actions.owner.to_string(), row.id),
        ]
    );
    assert!(
        f.store
            .get(f.session, row.id)
            .await
            .unwrap()
            .items
            .iter()
            .all(|item| item.status == ReviewItemStatus::Completed)
    );
}

#[tokio::test]
async fn recovering_an_interrupted_legacy_submission_resolves_for_the_owner() {
    let f = Fixture::new();
    let mut row = f.create(vec![json!({"subject":"x"})]).await;
    row.acting_user = None;
    row.items[0].status = ReviewItemStatus::Submitting;
    row.updated_at -= STALE_SUBMISSION_MS + 1;
    f.store
        .0
        .lock()
        .unwrap()
        .insert((f.session, row.id.0), row.clone());
    f.service.read(&f.view(), row.id).await.unwrap();
    assert_eq!(
        f.told(2).await[1],
        Told::Resolved(f.actions.owner.to_string(), row.id)
    );
}
