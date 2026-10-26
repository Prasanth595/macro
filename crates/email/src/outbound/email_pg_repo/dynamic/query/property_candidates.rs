//! Select DATE candidates with the existing email query's complete access and filter semantics.

#[cfg(test)]
mod test;

use super::*;
use crate::domain::models::PreviewCursorQuery;
use models_grouping::CandidatePage;
use properties::query_support::{
    CandidateRow, build_property_candidate_query, decode_candidate_page,
};

pub(crate) async fn property_candidates(
    pool: &PgPool,
    query: PreviewCursorQuery,
    selection: properties::AuthorizedPropertyQuery,
) -> Result<CandidatePage, sqlx::Error> {
    let filter = query
        .query
        .filter()
        .clone()
        .unwrap_or_else(|| Arc::new(Expr::Literal(EmailLiteral::CalendarOnly(false))));
    let viewer = selection.viewer().as_ref();
    let project_scope = resolve_project_scope(pool, &filter, viewer).await;
    let resolved = resolve_filters(pool, &query.link_ids, query.team_id, &filter).await?;
    if can_short_circuit(&filter, &resolved) {
        return Ok(CandidatePage::default());
    }
    let sort = selection
        .query()
        .timestamp_sort
        .unwrap_or(SimpleSortMethod::UpdatedAt);
    let params = QueryParams {
        link_ids: query.link_ids,
        sort_method_str: sort.to_string(),
        // SQL LIMIT NULL leaves the source unbounded. Only the outer property
        // query applies a limit, after complete filtering, counts, and ordering.
        query_limit: None,
        cursor_timestamp: None,
        cursor_id_str: None,
        is_important: matches!(
            query.view,
            PreviewView::StandardLabel(PreviewViewStandardLabel::Important)
        ),
        shared: extract_shared_filter(&filter),
        user_id: viewer.to_owned(),
        resolved,
        team_id: query.team_id,
        project_scope,
    };
    let mut sql = build_property_candidate_query(&selection, |sql| {
        sql.push("SELECT email.id::text AS id, 'THREAD'::text AS entity_type, email.sort_ts AS activity_at, email.project_id FROM (");
        push_query(sql, &query.view, &filter, params);
        sql.push(") email");
        Ok(())
    }).map_err(|error| sqlx::Error::Protocol(error.to_string()))?;
    let rows = sql
        .build_query_as::<CandidateRow>()
        .persistent(false)
        .fetch_all(pool)
        .await?;
    Ok(decode_candidate_page(rows, selection.query()))
}

pub(super) async fn resolve_project_scope(
    pool: &PgPool,
    filter: &Expr<EmailLiteral>,
    viewer: &str,
) -> Option<ProjectScope> {
    let project_ids = extract_project_filter(filter);
    if project_ids.is_empty() {
        return None;
    }
    let user = MacroUserIdStr::parse_from_str(viewer).ok();
    match get_user_source_ids(pool, user.as_deref()).await {
        Ok(source_ids) => Some(ProjectScope {
            project_ids,
            source_ids: source_ids.0,
        }),
        Err(error) => {
            tracing::error!(
                ?error,
                "unable to fetch source ids for project-scoped email query"
            );
            None
        }
    }
}
