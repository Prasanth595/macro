use std::sync::{Arc, Mutex};

use chrono::{DateTime, Utc};
use macro_user_id::{email::EmailStr, user_id::MacroUserIdStr};
use uuid::Uuid;

use crate::domain::{
    correspondence::{
        CorrespondenceWindow, Correspondent, EmailCorrespondence, EmailCorrespondenceRepo,
        OpenThread,
    },
    models::{EmailErr, EmailFilter, EmailInboxDetails, Link, LinkLabel, UserProvider},
    ports::EmailUserRepo,
};

use super::super::EmailServiceImpl;

#[derive(Clone, Default)]
struct FakeRepo {
    inboxes: Vec<Link>,
    queried_links: Arc<Mutex<Vec<Vec<Uuid>>>>,
}

impl EmailUserRepo for FakeRepo {
    async fn user_sender_filters(&self, _: Uuid) -> Result<Vec<EmailFilter>, EmailErr> {
        Ok(Vec::new())
    }
    async fn user_accessible_inboxes(
        &self,
        _: MacroUserIdStr<'static>,
    ) -> Result<Vec<Link>, EmailErr> {
        Ok(self.inboxes.clone())
    }
    async fn user_labels_for_link(&self, _: Uuid) -> Result<Vec<LinkLabel>, EmailErr> {
        Ok(Vec::new())
    }
    async fn user_inbox_details(
        &self,
        _: MacroUserIdStr<'static>,
    ) -> Result<Vec<EmailInboxDetails>, EmailErr> {
        Ok(Vec::new())
    }
}

impl EmailCorrespondenceRepo for FakeRepo {
    async fn correspondents(
        &self,
        link_ids: &[Uuid],
        _: CorrespondenceWindow,
    ) -> Result<Vec<Correspondent>, EmailErr> {
        self.queried_links.lock().unwrap().push(link_ids.to_vec());
        Ok(Vec::new())
    }
    async fn open_threads(
        &self,
        link_ids: &[Uuid],
        _: CorrespondenceWindow,
        _: DateTime<Utc>,
    ) -> Result<Vec<OpenThread>, EmailErr> {
        self.queried_links.lock().unwrap().push(link_ids.to_vec());
        Ok(Vec::new())
    }
}

fn link(id: Uuid, owner: &str) -> Link {
    Link {
        id,
        macro_id: MacroUserIdStr::try_from_email(owner).unwrap(),
        fusionauth_user_id: "internal-auth-id".to_owned(),
        email_address: EmailStr::try_from(owner.to_owned()).unwrap(),
        provider: UserProvider::Gmail,
        is_sync_active: true,
        is_primary: true,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

fn service(repo: FakeRepo) -> EmailServiceImpl<FakeRepo, (), (), (), (), ()> {
    EmailServiceImpl {
        email_repo: repo,
        frecency_service: (),
        enqueuer: (),
        crm_service: (),
        entity_access_management_service: (),
        macro_event_broker: (),
        sent_undo_delay_secs: 0,
        sender_provider: Arc::new(crate::domain::senders::UnavailableEmailSenderProvider),
    }
}

fn window() -> CorrespondenceWindow {
    CorrespondenceWindow {
        since: Utc::now(),
        limit: 10,
    }
}

/// A delegated inbox is someone else's mail: setup must not rank its
/// correspondents as the person's own.
#[tokio::test]
async fn reads_only_the_persons_own_inboxes() {
    let owned = Uuid::from_u128(1);
    let repo = FakeRepo {
        inboxes: vec![
            link(owned, "viewer@example.com"),
            link(Uuid::from_u128(2), "boss@example.com"),
        ],
        ..Default::default()
    };
    let queried = Arc::clone(&repo.queried_links);
    let user = MacroUserIdStr::try_from_email("viewer@example.com").unwrap();
    let service = service(repo);

    service
        .correspondents(user.clone(), window())
        .await
        .unwrap();
    service
        .open_threads(user, window(), Utc::now())
        .await
        .unwrap();

    assert_eq!(*queried.lock().unwrap(), vec![vec![owned], vec![owned]]);
}

#[tokio::test]
async fn no_own_inbox_reads_nothing() {
    let repo = FakeRepo {
        inboxes: vec![link(Uuid::from_u128(2), "boss@example.com")],
        ..Default::default()
    };
    let queried = Arc::clone(&repo.queried_links);
    let user = MacroUserIdStr::try_from_email("viewer@example.com").unwrap();

    let found = service(repo).correspondents(user, window()).await.unwrap();

    assert!(found.is_empty());
    assert!(queried.lock().unwrap().is_empty());
}
