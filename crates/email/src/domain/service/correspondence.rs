use chrono::{DateTime, Utc};
use macro_user_id::user_id::MacroUserIdStr;
use uuid::Uuid;

use crate::domain::{
    correspondence::{
        Correspondent, CorrespondenceWindow, EmailCorrespondence, EmailCorrespondenceRepo,
        OpenThread,
    },
    models::EmailErr,
    ports::EmailUserRepo,
};

use super::EmailServiceImpl;

#[cfg(test)]
mod test;

impl<T, U, E, CS, Eam, B> EmailServiceImpl<T, U, E, CS, Eam, B>
where
    T: EmailUserRepo,
{
    /// The person's own inboxes. Delegated inboxes are someone else's mail.
    async fn owned_link_ids(&self, user: &MacroUserIdStr<'static>) -> Result<Vec<Uuid>, EmailErr> {
        Ok(self
            .email_repo
            .user_accessible_inboxes(user.clone())
            .await?
            .into_iter()
            .filter(|link| link.macro_id == *user)
            .map(|link| link.id)
            .collect())
    }
}

impl<T, U, E, CS, Eam, B> EmailCorrespondence for EmailServiceImpl<T, U, E, CS, Eam, B>
where
    T: EmailUserRepo + EmailCorrespondenceRepo,
    U: Send + Sync + 'static,
    E: Send + Sync + 'static,
    CS: Send + Sync + 'static,
    Eam: Send + Sync + 'static,
    B: Send + Sync + 'static,
{
    async fn correspondents(
        &self,
        user: MacroUserIdStr<'static>,
        window: CorrespondenceWindow,
    ) -> Result<Vec<Correspondent>, EmailErr> {
        let links = self.owned_link_ids(&user).await?;
        if links.is_empty() {
            return Ok(Vec::new());
        }
        self.email_repo.correspondents(&links, window).await
    }

    async fn open_threads(
        &self,
        user: MacroUserIdStr<'static>,
        window: CorrespondenceWindow,
        stale_before: DateTime<Utc>,
    ) -> Result<Vec<OpenThread>, EmailErr> {
        let links = self.owned_link_ids(&user).await?;
        if links.is_empty() {
            return Ok(Vec::new());
        }
        self.email_repo
            .open_threads(&links, window, stale_before)
            .await
    }
}
