//! Facts a deal timeline shows when a watched pipeline cell changes.
//!
//! The cell stays the source of truth. The line is the same fact, written
//! once, for the discussion that already lists the deal's comments.

use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;

use chrono::{DateTime, Utc};
use databases::domain::models::{ColumnDetail, ColumnId, OpBatch};
use databases::domain::storage::StorageRow;
use macro_user_id::user_id::MacroUserIdStr;
use models_databases::{CellValue, DatabaseOp, OptionRef, RowChanges, RowId, RowsChange};
use models_properties::service::property_value::PropertyValue;
use uuid::Uuid;

// A date, a next activity, a plan, or an amount is already on the card.
// The timeline keeps the stage, the close, and who owns the deal.
const WATCHED: [&str; 3] = ["Stage", "Outcome", "Owner"];
const CLOSED: [&str; 3] = ["Won", "Lost", "Cancelled"];

/// One watched field on one deal, after a pipeline write.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DealFieldChange {
    /// The deal the row points at.
    pub deal_id: Uuid,
    /// Column name: `Stage`, `Outcome`, or `Owner`.
    pub field: String,
    /// The value the cell had. Absent when it was empty.
    pub from: Option<String>,
    /// The value the write stored. Absent when the cell was cleared.
    pub to: Option<String>,
}

/// Opens the delivery project when a deal is won.
pub trait DealDelivery: Send + Sync {
    /// Create the missing project for each deal. A failure must not undo the cell write.
    fn open(
        &self,
        actor: MacroUserIdStr<'static>,
        deal_ids: Vec<Uuid>,
    ) -> Pin<Box<dyn Future<Output = ()> + Send>>;
}

/// Deals whose outcome is Won after the batch, and was not Won before it.
pub fn won_deal_ids(changes: &[DealFieldChange]) -> Vec<Uuid> {
    let mut ids = Vec::new();
    for change in changes {
        if change.field == "Outcome"
            && change.to.as_deref() == Some("Won")
            && change.from.as_deref() != Some("Won")
            && !ids.contains(&change.deal_id)
        {
            ids.push(change.deal_id);
        }
    }
    ids
}

/// Records deal field changes where the discussion can read them.
pub trait DealChangeLog: Send + Sync {
    /// Persist the lines. A failure here must not undo the cell write.
    fn record(
        &self,
        actor: MacroUserIdStr<'static>,
        changes: Vec<DealFieldChange>,
    ) -> Pin<Box<dyn Future<Output = ()> + Send>>;
}

/// The watched changes in one batch. `rows` are the cells those rows had
/// before the batch. Inserts carry their deal id in the written cells.
pub fn deal_field_changes(
    columns: &[ColumnDetail],
    rows: &[StorageRow],
    batch: &OpBatch,
) -> Vec<DealFieldChange> {
    let Some(primary) = columns.iter().find(|column| column.name() == "Deal") else {
        return Vec::new();
    };
    let watched: Vec<_> = columns
        .iter()
        .filter(|column| WATCHED.contains(&column.name()))
        .collect();
    if watched.is_empty() {
        return Vec::new();
    }
    let before: HashMap<RowId, &HashMap<ColumnId, PropertyValue>> =
        rows.iter().map(|row| (row.row_id, &row.cells)).collect();
    let mut changes = Vec::new();
    for op in &batch.ops {
        let DatabaseOp::Rows { change, .. } = op else {
            continue;
        };
        match change {
            RowsChange::Insert { rows } => {
                for cells in rows {
                    push_changes(&mut changes, None, cells, primary, &watched, &before);
                }
            }
            RowsChange::Update {
                changes: RowChanges::Uniform { rows, cells },
            } => {
                for row in rows {
                    push_changes(&mut changes, Some(*row), cells, primary, &watched, &before);
                }
            }
            RowsChange::Update {
                changes: RowChanges::PerRow { rows },
            } => {
                for row in rows {
                    push_changes(
                        &mut changes,
                        Some(row.row),
                        &row.cells,
                        primary,
                        &watched,
                        &before,
                    );
                }
            }
            RowsChange::Delete { .. } => {}
        }
    }
    settled(changes)
}

/// One line per deal and field. `from` is the cell before the batch. `to` is
/// the value left after every write in it, including a schedule clear. An
/// outcome that is set and then replaced does not count as the one that stuck.
fn settled(changes: Vec<DealFieldChange>) -> Vec<DealFieldChange> {
    let mut index: HashMap<(Uuid, String), usize> = HashMap::new();
    let mut kept: Vec<DealFieldChange> = Vec::new();
    for change in changes {
        let key = (change.deal_id, change.field.clone());
        if let Some(slot) = index.get(&key).copied() {
            kept[slot].to = change.to;
        } else {
            index.insert(key, kept.len());
            kept.push(change);
        }
    }
    kept.retain(|change| change.from != change.to);
    kept
}

/// Row ids an update names. Inserts have no id until the write commits.
pub fn updated_row_ids(batch: &OpBatch) -> Vec<RowId> {
    let mut ids = Vec::new();
    for op in &batch.ops {
        let DatabaseOp::Rows { change, .. } = op else {
            continue;
        };
        match change {
            RowsChange::Update {
                changes: RowChanges::Uniform { rows, .. },
            } => ids.extend(rows.iter().copied()),
            RowsChange::Update {
                changes: RowChanges::PerRow { rows },
            } => ids.extend(rows.iter().map(|row| row.row)),
            _ => {}
        }
    }
    ids.sort();
    ids.dedup();
    ids
}

fn push_changes(
    out: &mut Vec<DealFieldChange>,
    row: Option<RowId>,
    cells: &[models_databases::CellWrite],
    primary: &ColumnDetail,
    watched: &[&ColumnDetail],
    before: &HashMap<RowId, &HashMap<ColumnId, PropertyValue>>,
) {
    let stored = row.and_then(|id| before.get(&id).copied());
    let Some(deal_id) = deal_id(primary, cells, stored) else {
        return;
    };
    for column in watched {
        let Some(write) = cells.iter().find(|cell| cell.column == column.column.id) else {
            continue;
        };
        let from = stored
            .and_then(|cells| cells.get(&column.column.id))
            .and_then(|value| stored_text(column, value));
        let to = written_text(column, &write.value);
        if from == to {
            continue;
        }
        out.push(DealFieldChange {
            deal_id,
            field: column.name().to_owned(),
            from,
            to,
        });
    }
}

fn deal_id(
    primary: &ColumnDetail,
    cells: &[models_databases::CellWrite],
    stored: Option<&HashMap<ColumnId, PropertyValue>>,
) -> Option<Uuid> {
    if let Some(cell) = cells.iter().find(|cell| cell.column == primary.column.id) {
        if let CellValue::Entities(refs) = &cell.value {
            if let Some(id) = refs
                .first()
                .and_then(|refer| Uuid::parse_str(&refer.entity_id).ok())
            {
                return Some(id);
            }
        }
    }
    let PropertyValue::EntityRef(refs) = stored?.get(&primary.column.id)? else {
        return None;
    };
    refs.first()
        .and_then(|refer| Uuid::parse_str(&refer.entity_id).ok())
}

fn written_text(column: &ColumnDetail, value: &CellValue) -> Option<String> {
    match value {
        CellValue::Clear => None,
        CellValue::Text(text) => Some(text.clone()),
        CellValue::Date(date) => Some(day(*date)),
        CellValue::Options(options) => options.first().map(|option| match option {
            OptionRef::Label(label) => label.clone(),
            OptionRef::Id(id) => option_label(column, (*id).into()),
        }),
        CellValue::Entities(refs) if column.name() == "Owner" => refs
            .first()
            .map(|refer| refer.entity_id.clone())
            .filter(|id| !id.is_empty()),
        CellValue::Number(_)
        | CellValue::Boolean(_)
        | CellValue::Link(_)
        | CellValue::Entities(_)
        | CellValue::Rows(_) => None,
    }
}

fn stored_text(column: &ColumnDetail, value: &PropertyValue) -> Option<String> {
    match value {
        PropertyValue::Str(text) => Some(text.clone()),
        PropertyValue::Date(date) => Some(day(*date)),
        PropertyValue::SelectOption(ids) => ids.first().map(|id| option_label(column, *id)),
        PropertyValue::EntityRef(refs) if column.name() == "Owner" => refs
            .first()
            .map(|refer| refer.entity_id.clone())
            .filter(|id| !id.is_empty()),
        PropertyValue::Bool(_)
        | PropertyValue::Num(_)
        | PropertyValue::EntityRef(_)
        | PropertyValue::Link(_) => None,
    }
}

fn option_label(column: &ColumnDetail, id: Uuid) -> String {
    column
        .definition
        .property_options
        .iter()
        .find(|option| option.id == id)
        .and_then(|option| option.value.as_string())
        .unwrap_or("option")
        .to_owned()
}

fn day(date: DateTime<Utc>) -> String {
    date.date_naive().to_string()
}

#[cfg(test)]
mod tests {
    use super::{ScheduleFacts, ScheduleTouch, ScheduleWrite, schedule_clears};

    fn facts(
        outcome: Option<&str>,
        when: Option<&str>,
        next: Option<&str>,
        plan: Option<&str>,
    ) -> ScheduleFacts {
        ScheduleFacts {
            when: when.map(str::to_owned),
            next: next.map(str::to_owned),
            plan: plan.map(str::to_owned),
            outcome: outcome.map(str::to_owned),
        }
    }

    fn value(text: &str) -> ScheduleWrite {
        ScheduleWrite::Value(text.to_owned())
    }

    #[test]
    fn a_date_on_a_closed_deal_reopens_it() {
        let clears = schedule_clears(
            &facts(Some("Cancelled"), None, None, None),
            &ScheduleTouch {
                when: value("2026-10-21"),
                ..ScheduleTouch::default()
            },
        );
        assert!(clears.outcome);
        assert!(!clears.when);
    }

    #[test]
    fn a_next_activity_on_a_won_deal_reopens_it() {
        let clears = schedule_clears(
            &facts(Some("Won"), Some("2026-10-21"), None, None),
            &ScheduleTouch {
                next: value("Call"),
                ..ScheduleTouch::default()
            },
        );
        assert!(clears.outcome);
        assert!(!clears.when);
    }

    #[test]
    fn closing_drops_the_appointment() {
        let clears = schedule_clears(
            &facts(None, Some("2026-10-21"), Some("Call"), Some("Ask")),
            &ScheduleTouch {
                outcome: value("Lost"),
                ..ScheduleTouch::default()
            },
        );
        assert!(clears.when && clears.next && clears.plan);
        assert!(!clears.outcome);
    }

    #[test]
    fn closing_beats_a_date_in_the_same_write() {
        let clears = schedule_clears(
            &facts(None, None, None, None),
            &ScheduleTouch {
                when: value("2026-10-21"),
                outcome: value("Cancelled"),
                ..ScheduleTouch::default()
            },
        );
        assert!(clears.when);
        assert!(!clears.outcome);
    }

    #[test]
    fn an_open_deal_keeps_an_empty_outcome() {
        let clears = schedule_clears(
            &facts(None, None, None, None),
            &ScheduleTouch {
                when: value("2026-10-21"),
                ..ScheduleTouch::default()
            },
        );
        assert!(!clears.outcome);
    }

    #[test]
    fn a_date_keeps_a_custom_outcome() {
        let clears = schedule_clears(
            &facts(Some("Waiting"), None, None, None),
            &ScheduleTouch {
                when: value("2026-10-21"),
                ..ScheduleTouch::default()
            },
        );
        assert!(!clears.outcome);
    }

    #[test]
    fn a_date_keeps_a_custom_outcome_written_with_it() {
        let clears = schedule_clears(
            &facts(Some("Won"), None, None, None),
            &ScheduleTouch {
                when: value("2026-10-21"),
                outcome: value("Waiting"),
                ..ScheduleTouch::default()
            },
        );
        assert!(!clears.outcome);
        assert!(!clears.when);
    }
}

/// What one watched cell does in this batch.
#[derive(Debug, Clone, PartialEq, Eq)]
enum ScheduleWrite {
    Absent,
    Clear,
    Value(String),
}

/// The appointment and the outcome a row already has.
struct ScheduleFacts {
    when: Option<String>,
    next: Option<String>,
    plan: Option<String>,
    outcome: Option<String>,
}

/// Cells the schedule rule empties so a closed deal has no appointment and a
/// scheduled deal is not closed.
#[derive(Debug, Default, PartialEq, Eq)]
struct ScheduleClears {
    when: bool,
    next: bool,
    plan: bool,
    outcome: bool,
}

/// A date or a next activity reopens the deal. Won, Lost, or Cancelled drops
/// the date, the next activity, and the plan. The same batch cannot do both:
/// closing wins.
fn schedule_clears(stored: &ScheduleFacts, touch: &ScheduleTouch) -> ScheduleClears {
    let sets = |write: &ScheduleWrite| matches!(write, ScheduleWrite::Value(_));
    let closing =
        matches!(&touch.outcome, ScheduleWrite::Value(value) if CLOSED.contains(&value.as_str()));
    if closing {
        let drop = |write: &ScheduleWrite, stored: &Option<String>| {
            !matches!(write, ScheduleWrite::Clear) && (stored.is_some() || sets(write))
        };
        return ScheduleClears {
            when: drop(&touch.when, &stored.when),
            next: drop(&touch.next, &stored.next),
            plan: drop(&touch.plan, &stored.plan),
            outcome: false,
        };
    }
    let scheduling = sets(&touch.when) || sets(&touch.next);
    // A custom outcome is a choice, not a close. A date reopens only Won,
    // Lost, or Cancelled, and only when this batch does not replace it.
    let closed_now = match &touch.outcome {
        ScheduleWrite::Absent => stored
            .outcome
            .as_deref()
            .is_some_and(|value| CLOSED.contains(&value)),
        ScheduleWrite::Clear | ScheduleWrite::Value(_) => false,
    };
    ScheduleClears {
        when: false,
        next: false,
        plan: false,
        outcome: scheduling && closed_now,
    }
}

struct ScheduleTouch {
    when: ScheduleWrite,
    next: ScheduleWrite,
    plan: ScheduleWrite,
    outcome: ScheduleWrite,
}

impl Default for ScheduleTouch {
    fn default() -> Self {
        Self {
            when: ScheduleWrite::Absent,
            next: ScheduleWrite::Absent,
            plan: ScheduleWrite::Absent,
            outcome: ScheduleWrite::Absent,
        }
    }
}

impl ScheduleTouch {
    fn touched(&self) -> bool {
        !matches!(
            (&self.when, &self.next, &self.plan, &self.outcome),
            (
                ScheduleWrite::Absent,
                ScheduleWrite::Absent,
                ScheduleWrite::Absent,
                ScheduleWrite::Absent
            )
        )
    }
}

/// Append the clears the schedule rule requires. A new row is cleared inside
/// its insert, because it has no id until the write commits. The caller's
/// writes stay first, so a later clear wins on a row that already exists.
pub fn schedule_follow_up(
    table: models_databases::TableId,
    columns: &[ColumnDetail],
    rows: &[StorageRow],
    mut batch: OpBatch,
) -> OpBatch {
    let Some(when_col) = columns.iter().find(|column| column.name() == "When") else {
        return batch;
    };
    let next_col = columns
        .iter()
        .find(|column| column.name() == "Next activity");
    let plan_col = columns.iter().find(|column| column.name() == "Plan");
    let outcome_col = columns.iter().find(|column| column.name() == "Outcome");
    let Some(outcome_col) = outcome_col else {
        return batch;
    };
    let stored_rows: HashMap<RowId, &HashMap<ColumnId, PropertyValue>> =
        rows.iter().map(|row| (row.row_id, &row.cells)).collect();
    for op in &mut batch.ops {
        let DatabaseOp::Rows {
            change: RowsChange::Insert { rows },
            ..
        } = op
        else {
            continue;
        };
        for cells in rows.iter_mut() {
            let touch = cells_touch(cells, when_col, next_col, plan_col, outcome_col);
            if !touch.touched() {
                continue;
            }
            let clears = schedule_clears(
                &ScheduleFacts {
                    when: None,
                    next: None,
                    plan: None,
                    outcome: None,
                },
                &touch,
            );
            if clears.when {
                clear_written(cells, when_col.column.id);
            }
            if clears.next {
                if let Some(column) = next_col {
                    clear_written(cells, column.column.id);
                }
            }
            if clears.plan {
                if let Some(column) = plan_col {
                    clear_written(cells, column.column.id);
                }
            }
            if clears.outcome {
                clear_written(cells, outcome_col.column.id);
            }
        }
    }
    let mut touches: HashMap<RowId, ScheduleTouch> = HashMap::new();
    for op in &batch.ops {
        let DatabaseOp::Rows { change, .. } = op else {
            continue;
        };
        let RowsChange::Update { changes } = change else {
            continue;
        };
        match changes {
            RowChanges::Uniform { rows, cells } => {
                for row in rows {
                    note_touch(
                        &mut touches,
                        *row,
                        cells,
                        when_col,
                        next_col,
                        plan_col,
                        outcome_col,
                    );
                }
            }
            RowChanges::PerRow { rows } => {
                for row in rows {
                    note_touch(
                        &mut touches,
                        row.row,
                        &row.cells,
                        when_col,
                        next_col,
                        plan_col,
                        outcome_col,
                    );
                }
            }
        }
    }
    let mut extras = Vec::new();
    for (row, touch) in touches {
        if !touch.touched() {
            continue;
        }
        let stored_cells = stored_rows.get(&row).copied();
        let stored = ScheduleFacts {
            when: stored_field(stored_cells, when_col),
            next: next_col.and_then(|column| stored_field(stored_cells, column)),
            plan: plan_col.and_then(|column| stored_field(stored_cells, column)),
            outcome: stored_field(stored_cells, outcome_col),
        };
        let clears = schedule_clears(&stored, &touch);
        let mut cells = Vec::new();
        if clears.when {
            cells.push(clear(when_col.column.id));
        }
        if clears.next {
            if let Some(column) = next_col {
                cells.push(clear(column.column.id));
            }
        }
        if clears.plan {
            if let Some(column) = plan_col {
                cells.push(clear(column.column.id));
            }
        }
        if clears.outcome {
            cells.push(clear(outcome_col.column.id));
        }
        if !cells.is_empty() {
            extras.push(models_databases::RowChange { row, cells });
        }
    }
    if extras.is_empty() {
        return batch;
    }
    batch.ops.push(DatabaseOp::Rows {
        table,
        change: RowsChange::Update {
            changes: RowChanges::PerRow { rows: extras },
        },
    });
    batch
}

fn cells_touch(
    cells: &[models_databases::CellWrite],
    when_col: &ColumnDetail,
    next_col: Option<&ColumnDetail>,
    plan_col: Option<&ColumnDetail>,
    outcome_col: &ColumnDetail,
) -> ScheduleTouch {
    let mut touches = HashMap::new();
    note_touch(
        &mut touches,
        RowId::from_uuid(Uuid::nil()),
        cells,
        when_col,
        next_col,
        plan_col,
        outcome_col,
    );
    touches.into_values().next().unwrap_or_default()
}

fn clear_written(cells: &mut [models_databases::CellWrite], column: ColumnId) {
    if let Some(cell) = cells.iter_mut().find(|cell| cell.column == column) {
        cell.value = CellValue::Clear;
    }
}

fn note_touch(
    touches: &mut HashMap<RowId, ScheduleTouch>,
    row: RowId,
    cells: &[models_databases::CellWrite],
    when_col: &ColumnDetail,
    next_col: Option<&ColumnDetail>,
    plan_col: Option<&ColumnDetail>,
    outcome_col: &ColumnDetail,
) {
    let touch = touches.entry(row).or_default();
    for cell in cells {
        let write = schedule_write(cell, when_col, next_col, plan_col, outcome_col);
        if cell.column == when_col.column.id {
            if let Some(write) = write {
                touch.when = write;
            }
        } else if next_col.is_some_and(|column| cell.column == column.column.id) {
            if let Some(write) = write {
                touch.next = write;
            }
        } else if plan_col.is_some_and(|column| cell.column == column.column.id) {
            if let Some(write) = write {
                touch.plan = write;
            }
        } else if cell.column == outcome_col.column.id {
            if let Some(write) = write {
                touch.outcome = write;
            }
        }
    }
}

fn schedule_write(
    cell: &models_databases::CellWrite,
    when_col: &ColumnDetail,
    next_col: Option<&ColumnDetail>,
    plan_col: Option<&ColumnDetail>,
    outcome_col: &ColumnDetail,
) -> Option<ScheduleWrite> {
    let column = [Some(when_col), next_col, plan_col, Some(outcome_col)]
        .into_iter()
        .flatten()
        .find(|column| column.column.id == cell.column)?;
    Some(match &cell.value {
        CellValue::Clear => ScheduleWrite::Clear,
        value => match written_text(column, value) {
            Some(text) => ScheduleWrite::Value(text),
            None => ScheduleWrite::Clear,
        },
    })
}

fn stored_field(
    cells: Option<&HashMap<ColumnId, PropertyValue>>,
    column: &ColumnDetail,
) -> Option<String> {
    cells
        .and_then(|cells| cells.get(&column.column.id))
        .and_then(|value| stored_text(column, value))
}

fn clear(column: ColumnId) -> models_databases::CellWrite {
    models_databases::CellWrite {
        column,
        value: CellValue::Clear,
    }
}

#[cfg(test)]
mod batch {
    use std::collections::HashMap;

    use chrono::{TimeZone, Utc};
    use databases::domain::models::Column;
    use databases::domain::storage::StorageRow;
    use models_databases::{
        CellValue, CellWrite, DatabaseOp, OptionRef, RowChanges, RowId, RowsChange, TableId,
    };
    use models_properties::service::property_definition::PropertyDefinition;
    use models_properties::service::property_definition_with_options::PropertyDefinitionWithOptions;
    use models_properties::service::property_value::PropertyValue;
    use models_properties::shared::{DataType, EntityReference, EntityType, PropertyOwner};
    use uuid::Uuid;

    use databases::domain::models::OpBatch;

    use super::{deal_field_changes, schedule_follow_up, won_deal_ids};

    fn column(table: TableId, name: &str, n: u128) -> databases::domain::models::ColumnDetail {
        let id = Uuid::from_u128(n);
        databases::domain::models::ColumnDetail {
            column: Column {
                id: models_databases::ColumnId::from_uuid(id),
                table_id: table,
                property_definition_id: id,
                position: "80".parse().unwrap(),
                config: None,
                display_name: Some(name.to_owned()),
                infer_type: false,
                protections: vec![],
                nullable: true,
            },
            sql_name: format!("\"{name}\""),
            definition: PropertyDefinitionWithOptions {
                definition: PropertyDefinition {
                    id,
                    owner: PropertyOwner::Database {
                        database_id: Uuid::from_u128(1),
                    },
                    display_name: name.to_owned(),
                    data_type: DataType::String,
                    is_multi_select: false,
                    specific_entity_type: None,
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                    is_system: false,
                    is_metadata: false,
                },
                property_options: vec![],
            },
            writable: true,
            shared_outside_database: false,
        }
    }

    struct Board {
        table: TableId,
        columns: Vec<databases::domain::models::ColumnDetail>,
    }

    fn board() -> Board {
        let table = TableId::from_uuid(Uuid::from_u128(2));
        Board {
            columns: vec![
                column(table, "Deal", 10),
                column(table, "When", 11),
                column(table, "Next activity", 12),
                column(table, "Plan", 13),
                column(table, "Outcome", 14),
            ],
            table,
        }
    }

    fn id_of(board: &Board, name: &str) -> models_databases::ColumnId {
        board
            .columns
            .iter()
            .find(|column| column.name() == name)
            .unwrap()
            .column
            .id
    }

    fn label(column: models_databases::ColumnId, text: &str) -> CellWrite {
        CellWrite {
            column,
            value: CellValue::Options(vec![OptionRef::Label(text.to_owned())]),
        }
    }

    fn text(column: models_databases::ColumnId, text: &str) -> CellWrite {
        CellWrite {
            column,
            value: CellValue::Text(text.to_owned()),
        }
    }

    fn date(column: models_databases::ColumnId) -> CellWrite {
        CellWrite {
            column,
            value: CellValue::Date(Utc.with_ymd_and_hms(2026, 10, 21, 0, 0, 0).unwrap()),
        }
    }

    fn update(table: TableId, row: RowId, cells: Vec<CellWrite>) -> DatabaseOp {
        DatabaseOp::Rows {
            table,
            change: RowsChange::Update {
                changes: RowChanges::PerRow {
                    rows: vec![models_databases::RowChange { row, cells }],
                },
            },
        }
    }

    fn stored(row: RowId, deal_column: models_databases::ColumnId, deal: Uuid) -> StorageRow {
        let mut cells = HashMap::new();
        cells.insert(
            deal_column,
            PropertyValue::EntityRef(vec![EntityReference::new(
                deal.to_string(),
                EntityType::Deal,
            )]),
        );
        StorageRow { row_id: row, cells }
    }

    fn batch(ops: Vec<DatabaseOp>) -> OpBatch {
        OpBatch {
            ops,
            base_versions: HashMap::new(),
        }
    }

    #[test]
    fn a_deal_born_won_drops_its_appointment() {
        let board = board();
        let when = id_of(&board, "When");
        let next = id_of(&board, "Next activity");
        let plan = id_of(&board, "Plan");
        let outcome = id_of(&board, "Outcome");
        let written = schedule_follow_up(
            board.table,
            &board.columns,
            &[],
            batch(vec![DatabaseOp::Rows {
                table: board.table,
                change: RowsChange::Insert {
                    rows: vec![vec![
                        date(when),
                        text(next, "Call"),
                        text(plan, "Ask"),
                        label(outcome, "Won"),
                    ]],
                },
            }]),
        );
        let DatabaseOp::Rows {
            change: RowsChange::Insert { rows },
            ..
        } = &written.ops[0]
        else {
            panic!("insert stayed an insert");
        };
        assert!(
            rows[0]
                .iter()
                .any(|cell| cell.column == when && cell.value == CellValue::Clear)
        );
        assert!(
            rows[0]
                .iter()
                .any(|cell| cell.column == next && cell.value == CellValue::Clear)
        );
        assert!(
            rows[0]
                .iter()
                .any(|cell| cell.column == plan && cell.value == CellValue::Clear)
        );
        assert!(
            rows[0].iter().any(|cell| {
                cell.column == outcome && matches!(cell.value, CellValue::Options(_))
            })
        );
        assert_eq!(written.ops.len(), 1);
    }

    #[test]
    fn a_deal_born_open_keeps_its_date() {
        let board = board();
        let when = id_of(&board, "When");
        let written = schedule_follow_up(
            board.table,
            &board.columns,
            &[],
            batch(vec![DatabaseOp::Rows {
                table: board.table,
                change: RowsChange::Insert {
                    rows: vec![vec![date(when)]],
                },
            }]),
        );
        let DatabaseOp::Rows {
            change: RowsChange::Insert { rows },
            ..
        } = &written.ops[0]
        else {
            panic!("insert stayed an insert");
        };
        assert!(matches!(rows[0][0].value, CellValue::Date(_)));
    }

    #[test]
    fn won_then_lost_in_one_batch_stays_lost() {
        let board = board();
        let deal = Uuid::from_u128(8);
        let row = RowId::from_uuid(Uuid::from_u128(9));
        let outcome = id_of(&board, "Outcome");
        let rows = vec![stored(row, id_of(&board, "Deal"), deal)];
        let written = schedule_follow_up(
            board.table,
            &board.columns,
            &rows,
            batch(vec![
                update(board.table, row, vec![label(outcome, "Won")]),
                update(board.table, row, vec![label(outcome, "Lost")]),
            ]),
        );
        let changes = deal_field_changes(&board.columns, &rows, &written);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].to.as_deref(), Some("Lost"));
        assert!(changes[0].from.is_none());
        assert!(won_deal_ids(&changes).is_empty());
    }

    #[test]
    fn one_won_still_opens_a_project() {
        let board = board();
        let deal = Uuid::from_u128(8);
        let row = RowId::from_uuid(Uuid::from_u128(9));
        let outcome = id_of(&board, "Outcome");
        let rows = vec![stored(row, id_of(&board, "Deal"), deal)];
        let written = schedule_follow_up(
            board.table,
            &board.columns,
            &rows,
            batch(vec![update(board.table, row, vec![label(outcome, "Won")])]),
        );
        let changes = deal_field_changes(&board.columns, &rows, &written);
        assert_eq!(won_deal_ids(&changes), vec![deal]);
    }

    #[test]
    fn a_date_does_not_clear_a_custom_outcome() {
        let board = board();
        let row = RowId::from_uuid(Uuid::from_u128(9));
        let mut row_cells = stored(row, id_of(&board, "Deal"), Uuid::from_u128(8));
        row_cells.cells.insert(
            id_of(&board, "Outcome"),
            PropertyValue::Str("Waiting".to_owned()),
        );
        let rows = vec![row_cells];
        let written = schedule_follow_up(
            board.table,
            &board.columns,
            &rows,
            batch(vec![update(
                board.table,
                row,
                vec![date(id_of(&board, "When"))],
            )]),
        );
        assert_eq!(written.ops.len(), 1);
    }
}
