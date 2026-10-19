//! A deal is one commercial opportunity. Companies and people stay the
//! directory; the deal names the ones it involves.

use uuid::Uuid;

/// One deal the caller's team can see, with the records it links.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Deal {
    /// Identity. A deal pipeline's primary column stores this.
    pub id: Uuid,
    /// The name shown on the card.
    pub name: String,
    /// Companies this deal involves. Each belongs to the deal's team.
    pub company_ids: Vec<Uuid>,
    /// People this deal involves. Each belongs to the deal's team.
    pub contact_ids: Vec<Uuid>,
    /// The one free paragraph on the deal. Empty when nobody has written it.
    pub description: String,
    /// The delivery project opened when this deal was won. Absent until then.
    pub delivery_initiative_id: Option<Uuid>,
}

/// One deal of a company, with the pipeline facts that are only displayed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CompanyDeal {
    /// The deal.
    pub id: Uuid,
    /// The name shown on the card.
    pub name: String,
    /// The deal pipeline that holds this row, when the deal is on a board.
    pub pipeline_id: Option<Uuid>,
    /// That pipeline's name.
    pub pipeline_name: Option<String>,
    /// Stage label. Empty when the row has no stage.
    pub stage: Option<String>,
    /// Outcome label: Won, Lost, or Cancelled.
    pub outcome: Option<String>,
    /// The date cell, as `YYYY-MM-DD`.
    pub when_on: Option<String>,
    /// Revenue, as stored.
    pub revenue: Option<String>,
    /// The delivery project, once the deal is won.
    pub delivery_initiative_id: Option<Uuid>,
}
