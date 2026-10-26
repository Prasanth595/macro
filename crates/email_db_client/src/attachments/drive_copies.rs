use sqlx::PgPool;
use sqlx::types::Uuid;

pub struct DriveCopyRow {
    pub document_id: String,
    pub name: String,
}

pub struct OwnedDocumentRow {
    pub owner: String,
    pub deleted: bool,
    pub email_attachment: bool,
}

pub async fn list(
    db: &PgPool,
    email_attachment_id: Uuid,
    owner_id: &str,
) -> anyhow::Result<Vec<DriveCopyRow>> {
    let rows = sqlx::query!(
        r#"
        SELECT c.document_id, d.name
        FROM email_attachment_drive_copies c
        INNER JOIN "Document" d ON d.id = c.document_id
        WHERE c.email_attachment_id = $1
          AND c.owner_id = $2
          AND d."deletedAt" IS NULL
        ORDER BY c.created_at ASC
        "#,
        email_attachment_id,
        owner_id,
    )
    .fetch_all(db)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| DriveCopyRow {
            document_id: row.document_id,
            name: row.name,
        })
        .collect())
}

pub async fn insert(
    db: &PgPool,
    email_attachment_id: Uuid,
    document_id: &str,
    owner_id: &str,
) -> anyhow::Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO email_attachment_drive_copies (email_attachment_id, document_id, owner_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (email_attachment_id, document_id) DO NOTHING
        "#,
        email_attachment_id,
        document_id,
        owner_id,
    )
    .execute(db)
    .await?;
    Ok(())
}

pub async fn owned_document(
    db: &PgPool,
    document_id: &str,
) -> anyhow::Result<Option<OwnedDocumentRow>> {
    let row = sqlx::query!(
        r#"
        SELECT d."owner" AS owner,
               (d."deletedAt" IS NOT NULL) AS "deleted!",
               EXISTS(
                   SELECT 1 FROM document_email de WHERE de.document_id = d.id
               ) AS "email_attachment!"
        FROM "Document" d
        WHERE d.id = $1
        "#,
        document_id,
    )
    .fetch_optional(db)
    .await?;

    Ok(row.map(|row| OwnedDocumentRow {
        owner: row.owner,
        deleted: row.deleted,
        email_attachment: row.email_attachment,
    }))
}

pub async fn email_attachment_for_document(
    db: &PgPool,
    document_id: &str,
) -> anyhow::Result<Option<Uuid>> {
    let row = sqlx::query!(
        r#"
        SELECT email_attachment_id
        FROM document_email
        WHERE document_id = $1
        LIMIT 1
        "#,
        document_id,
    )
    .fetch_optional(db)
    .await?;

    Ok(row.map(|row| row.email_attachment_id))
}
