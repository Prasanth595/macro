use super::*;

#[tokio::test]
async fn an_inbox_submit_runs_the_drafts_and_records_the_inbox() {
    let f = Fixture::new();
    let row = f.create(vec![json!({"subject":"x"})]).await;
    let claimed = f
        .service
        .decide_from_inbox(
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
    assert_eq!(claimed.decision.unwrap().via, DecisionVia::Inbox);
    let settled = f.settled(row.id).await;
    assert_eq!(settled.items[0].status, ReviewItemStatus::Completed);
    assert_eq!(f.actions.calls.lock().unwrap().len(), 1);
    assert!(f.store.2.lock().unwrap().iter().all(|pending| matches!(
        &pending.notification.event,
        NotificationEvent::ReviewDecided(outcome) | NotificationEvent::ReviewSettled(outcome)
            if outcome.via == DecisionVia::Inbox
    )));
    assert_eq!(
        f.told(2).await[1],
        Told::Resolved(f.actions.owner.to_string(), row.id)
    );
}

#[tokio::test]
async fn the_inbox_leaves_editing_to_the_review() {
    let f = Fixture::new();
    let row = f.create(vec![json!({"subject":"x"})]).await;
    assert!(matches!(
        f.service
            .decide_from_inbox(
                &f.edit(),
                &f.actions.owner,
                row.id,
                ReviewDecision::Edit {
                    revision: row.revision,
                    item: row.items[0].id,
                    draft: json!({"subject":"edited"}),
                },
            )
            .await,
        Err(CodeModeError::Invalid(_))
    ));
    let unchanged = f.store.get(f.session, row.id).await.unwrap();
    assert_eq!(unchanged.revision, row.revision);
    assert_eq!(unchanged.items[0].draft, json!({"subject":"x"}));
}

#[tokio::test]
async fn an_inbox_submit_waits_until_the_review_is_approvable_but_dismiss_does_not() {
    let f = Fixture::new();
    let row = f.create(vec![json!({"subject":"x"})]).await;
    f.actions.approvable.store(false, Ordering::SeqCst);
    assert!(matches!(
        f.service
            .decide_from_inbox(
                &f.edit(),
                &f.actions.owner,
                row.id,
                ReviewDecision::Submit {
                    revision: row.revision,
                    items: vec![],
                },
            )
            .await,
        Err(CodeModeError::Invalid(_))
    ));
    assert_eq!(
        f.store.get(f.session, row.id).await.unwrap().revision,
        row.revision
    );
    let dismissed = f
        .service
        .decide_from_inbox(
            &f.edit(),
            &f.actions.owner,
            row.id,
            ReviewDecision::Dismiss {
                revision: row.revision,
                items: vec![],
            },
        )
        .await
        .unwrap();
    assert_eq!(dismissed.items[0].status, ReviewItemStatus::Dismissed);
    assert!(f.actions.calls.lock().unwrap().is_empty());
}

#[tokio::test]
async fn the_inbox_acts_only_for_the_reviews_account_holder() {
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
    for decision in [
        ReviewDecision::Submit {
            revision: row.revision,
            items: vec![],
        },
        ReviewDecision::Dismiss {
            revision: row.revision,
            items: vec![],
        },
    ] {
        assert!(matches!(
            f.service
                .decide_from_inbox(&f.edit(), &f.actions.owner, row.id, decision)
                .await,
            Err(CodeModeError::Forbidden)
        ));
    }
    assert_eq!(
        f.store.get(f.session, row.id).await.unwrap().items[0].status,
        ReviewItemStatus::Pending
    );
}
