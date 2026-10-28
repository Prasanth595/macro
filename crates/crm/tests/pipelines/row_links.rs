//! The real CRM/database services preserve source access and both row identities.

use super::*;
use crm::domain::row_links::{
    CrmRowLinks, LinkedRowReference, RowLinkAccess, RowLinkTarget, RowLinksRepo, RowLinksService,
};
use crm::outbound::row_links::PgRowLinksRepo;
use databases::domain::{
    models::{CreateDatabase, Viewer},
    ports::DatabasesService,
    storage::DatabaseStorageService,
};

async fn create_source(db: &DatabaseService, a: &Access) -> LinkedRowReference {
    let database = db
        .create_database(CreateDatabase {
            name: "Invoices".into(),
            owner_id: user(OWNER),
            acting_bot: None,
        })
        .await
        .unwrap();
    let detail = db
        .get_database(access(a, database.id.into_uuid(), EntityType::Database, OWNER).await)
        .await
        .unwrap();
    let table = &detail.tables[0];
    let result = db
        .apply_storage_ops(
            database.id,
            Viewer {
                user_id: user(OWNER),
                acting_bot: None,
            },
            vec![DatabaseOp::Rows {
                table: table.table.id,
                change: RowsChange::Insert {
                    rows: vec![vec![CellWrite {
                        column: table.columns[0].column.id,
                        value: CellValue::Text("Invoice 42".into()),
                    }]],
                },
            }]
            .into(),
        )
        .await
        .unwrap();
    LinkedRowReference {
        database_id: database.id,
        table_id: table.table.id,
        row_id: inserted(&result.results),
    }
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn concurrent_links_respect_the_limit_and_target_deletion_cleans_up(pool: PgPool) {
    let (pipeline, db, a, team, company) = fixture(&pool).await;
    let p = create(&pipeline, team, PipelineRecordType::Company).await;
    let entry = inserted(
        &write(&pipeline, &a, &p, vec![insert(&p, company)])
            .await
            .unwrap(),
    );
    let source = create_source(&db, &a).await;
    let result = db
        .apply_storage_ops(
            source.database_id,
            Viewer {
                user_id: user(OWNER),
                acting_bot: None,
            },
            vec![DatabaseOp::Rows {
                table: source.table_id,
                change: RowsChange::Insert {
                    rows: vec![vec![]; 101],
                },
            }]
            .into(),
        )
        .await
        .unwrap();
    let OpResult::Rows {
        change: RowsResult::Inserted { rows },
        ..
    } = &result.results[0]
    else {
        panic!("inserted rows");
    };
    let repo = PgRowLinksRepo::new(pool.clone());
    let target = RowLinkTarget::Entry(p.id, entry);
    for row in &rows[..99] {
        assert!(
            repo.link(
                target,
                LinkedRowReference {
                    row_id: *row,
                    ..source
                }
            )
            .await
            .unwrap()
        );
    }
    let (first, second) = tokio::join!(
        repo.link(
            target,
            LinkedRowReference {
                row_id: rows[99],
                ..source
            }
        ),
        repo.link(
            target,
            LinkedRowReference {
                row_id: rows[100],
                ..source
            }
        ),
    );
    assert_ne!(first.unwrap(), second.unwrap());
    assert_eq!(repo.list(target).await.unwrap().len(), 100);
    assert!(
        repo.link(
            target,
            LinkedRowReference {
                row_id: rows[0],
                ..source
            }
        )
        .await
        .unwrap()
    );
    write(
        &pipeline,
        &a,
        &p,
        vec![DatabaseOp::Rows {
            table: p.table_id,
            change: RowsChange::Delete { rows: vec![entry] },
        }],
    )
    .await
    .unwrap();
    assert!(repo.list(target).await.unwrap().is_empty());
    assert_eq!(
        db.storage_row_cells(source.database_id, source.table_id, rows)
            .await
            .unwrap()
            .len(),
        101
    );
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn private_sources_stay_private_and_links_follow_live_values(pool: PgPool) {
    let (pipeline, db, a, team, company) = fixture(&pool).await;
    // Access source IDs are cached process-wide, so this test's viewer must
    // not share the fixed fixture identity with other isolated test databases.
    let viewer = format!("macro|linked-row-viewer-{}@macro.com", Uuid::now_v7());
    let viewer_id = Uuid::now_v7();
    sqlx::query!(
        "INSERT INTO macro_user (id, username, email, stripe_customer_id) VALUES ($1, $2, $2, $2)",
        viewer_id,
        viewer,
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query!(
        r#"INSERT INTO "User" (id, email, macro_user_id) VALUES ($1, $1, $2)"#,
        viewer,
        viewer_id,
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query!(
        "INSERT INTO team_user (team_id, user_id, team_role) VALUES ($1, $2, 'member')",
        team,
        viewer,
    )
    .execute(&pool)
    .await
    .unwrap();
    let p = create(&pipeline, team, PipelineRecordType::Company).await;
    pipeline
        .share(
            access(&a, p.id, EntityType::CrmPipeline, OWNER).await,
            PipelineSharing::Team,
        )
        .await
        .unwrap();
    let row = inserted(
        &write(&pipeline, &a, &p, vec![insert(&p, company)])
            .await
            .unwrap(),
    );
    let source = create_source(&db, &a).await;
    let links = RowLinksService::new(
        PgRowLinksRepo::new(pool.clone()),
        db.clone(),
        Arc::new(pipeline),
        a.clone(),
    );
    links
        .link(
            RowLinkAccess::Entry(access(&a, p.id, EntityType::CrmPipeline, OWNER).await, row),
            source,
        )
        .await
        .unwrap();
    // A retry is one durable reference, not a duplicate preview.
    links
        .link(
            RowLinkAccess::Entry(access(&a, p.id, EntityType::CrmPipeline, OWNER).await, row),
            source,
        )
        .await
        .unwrap();
    let visible = links
        .list(RowLinkAccess::Entry(
            access(&a, p.id, EntityType::CrmPipeline, OWNER).await,
            row,
        ))
        .await
        .unwrap();
    assert_eq!(visible.tables.len(), 1);
    assert_eq!(visible.tables[0].rows.len(), 1);
    assert_eq!(visible.tables[0].rows[0].row_id, source.row_id);
    // Editing the deal does not give its teammate any source metadata or counts.
    let hidden = links
        .list(RowLinkAccess::Entry(
            access(&a, p.id, EntityType::CrmPipeline, &viewer).await,
            row,
        ))
        .await
        .unwrap();
    assert!(hidden.tables.is_empty());
    assert!(matches!(
        links
            .link(
                RowLinkAccess::Entry(
                    access(&a, p.id, EntityType::CrmPipeline, &viewer).await,
                    row
                ),
                source
            )
            .await,
        Err(PipelineError::NotFound)
    ));

    // An independent source grant makes the preview visible; revoking it hides
    // the same persisted link on the next read without leaking a stale title.
    for granted in [true, false] {
        if granted {
            sqlx::query!(
                "INSERT INTO entity_access (entity_id, entity_type, source_id, source_type, access_level) VALUES ($1, 'database', $2, 'user', 'view')",
                source.database_id.into_uuid(), &viewer,
            ).execute(&pool).await.unwrap();
        } else {
            sqlx::query!(
                "DELETE FROM entity_access WHERE entity_id = $1 AND entity_type = 'database' AND source_id = $2 AND source_type = 'user'",
                source.database_id.into_uuid(), &viewer,
            ).execute(&pool).await.unwrap();
        }
        let current = links
            .list(RowLinkAccess::Entry(
                access(&a, p.id, EntityType::CrmPipeline, &viewer).await,
                row,
            ))
            .await
            .unwrap();
        assert_eq!(current.tables.len(), usize::from(granted));
        if granted {
            links
                .link(
                    RowLinkAccess::Entry(
                        access(&a, p.id, EntityType::CrmPipeline, &viewer).await,
                        row,
                    ),
                    source,
                )
                .await
                .unwrap();
        }
    }
    // The target editor can still remove a known reference after source access
    // is lost; unlink never needs permission to modify the source row.
    links
        .unlink(
            RowLinkAccess::Entry(
                access(&a, p.id, EntityType::CrmPipeline, &viewer).await,
                row,
            ),
            source.row_id,
        )
        .await
        .unwrap();
    links
        .link(
            RowLinkAccess::Entry(access(&a, p.id, EntityType::CrmPipeline, OWNER).await, row),
            source,
        )
        .await
        .unwrap();

    db.rename_database(
        access(
            &a,
            source.database_id.into_uuid(),
            EntityType::Database,
            OWNER,
        )
        .await,
        "Billing".into(),
    )
    .await
    .unwrap();
    let column = visible.tables[0].table.columns[0].column.id;
    db.apply_storage_ops(
        source.database_id,
        Viewer {
            user_id: user(OWNER),
            acting_bot: None,
        },
        vec![
            DatabaseOp::Table {
                table: source.table_id,
                change: TableChange::Rename {
                    name: "Paid invoices".into(),
                    previous_name: Some(visible.tables[0].table.table.name.clone()),
                },
            },
            DatabaseOp::Rows {
                table: source.table_id,
                change: RowsChange::Update {
                    changes: RowChanges::Uniform {
                        rows: vec![source.row_id],
                        cells: vec![CellWrite {
                            column,
                            value: CellValue::Text("Invoice 42 paid".into()),
                        }],
                    },
                },
            },
        ]
        .into(),
    )
    .await
    .unwrap();
    let renamed = links
        .list(RowLinkAccess::Entry(
            access(&a, p.id, EntityType::CrmPipeline, OWNER).await,
            row,
        ))
        .await
        .unwrap();
    assert_eq!(renamed.tables[0].database_name, "Billing");
    assert_eq!(renamed.tables[0].table.table.name, "Paid invoices");
    assert_eq!(renamed.tables[0].rows[0].row_id, source.row_id);
    assert_eq!(
        serde_json::to_value(&renamed.tables[0].rows[0].cells[&column]).unwrap()["value"],
        "Invoice 42 paid"
    );

    db.trash_database(
        access(
            &a,
            source.database_id.into_uuid(),
            EntityType::Database,
            OWNER,
        )
        .await,
    )
    .await
    .unwrap();
    assert!(
        links
            .list(RowLinkAccess::Entry(
                access(&a, p.id, EntityType::CrmPipeline, OWNER).await,
                row
            ))
            .await
            .unwrap()
            .tables
            .is_empty()
    );
    db.restore_database(
        access(
            &a,
            source.database_id.into_uuid(),
            EntityType::Database,
            OWNER,
        )
        .await,
    )
    .await
    .unwrap();
    assert_eq!(
        links
            .list(RowLinkAccess::Entry(
                access(&a, p.id, EntityType::CrmPipeline, OWNER).await,
                row
            ))
            .await
            .unwrap()
            .tables[0]
            .rows
            .len(),
        1
    );
    db.apply_storage_ops(
        source.database_id,
        Viewer {
            user_id: user(OWNER),
            acting_bot: None,
        },
        vec![DatabaseOp::Rows {
            table: source.table_id,
            change: RowsChange::Delete {
                rows: vec![source.row_id],
            },
        }]
        .into(),
    )
    .await
    .unwrap();
    assert!(
        links
            .list(RowLinkAccess::Entry(
                access(&a, p.id, EntityType::CrmPipeline, OWNER).await,
                row
            ))
            .await
            .unwrap()
            .tables
            .is_empty()
    );
    assert!(
        PgRowLinksRepo::new(pool)
            .list(RowLinkTarget::Entry(p.id, row))
            .await
            .unwrap()
            .is_empty()
    );
}

#[sqlx::test(migrator = "MACRO_DB_MIGRATIONS")]
async fn references_are_scoped_to_the_entry_and_unlink_never_edits_sources(pool: PgPool) {
    let (pipeline, db, a, team, company) = fixture(&pool).await;
    let p = create(&pipeline, team, PipelineRecordType::Company).await;
    let other = create(&pipeline, team, PipelineRecordType::Company).await;
    let first = inserted(
        &write(&pipeline, &a, &p, vec![insert(&p, company)])
            .await
            .unwrap(),
    );
    let second = inserted(
        &write(&pipeline, &a, &p, vec![insert(&p, company)])
            .await
            .unwrap(),
    );
    let source = create_source(&db, &a).await;
    let another = create_source(&db, &a).await;
    let links = RowLinksService::new(
        PgRowLinksRepo::new(pool.clone()),
        db.clone(),
        Arc::new(pipeline),
        a.clone(),
    );
    assert!(matches!(
        links
            .link(
                RowLinkAccess::Entry(
                    access(&a, other.id, EntityType::CrmPipeline, OWNER).await,
                    first
                ),
                source
            )
            .await,
        Err(PipelineError::NotFound)
    ));
    assert!(matches!(
        links
            .link(
                RowLinkAccess::Entry(
                    access(&a, p.id, EntityType::CrmPipeline, OWNER).await,
                    first
                ),
                LinkedRowReference {
                    table_id: another.table_id,
                    ..source
                }
            )
            .await,
        Err(PipelineError::NotFound)
    ));
    for (entry, reference) in [(first, source), (first, another), (second, source)] {
        links
            .link(
                RowLinkAccess::Entry(
                    access(&a, p.id, EntityType::CrmPipeline, OWNER).await,
                    entry,
                ),
                reference,
            )
            .await
            .unwrap();
    }
    // A company link is a separate association from either of its pursuits.
    let repo = PgRowLinksRepo::new(pool.clone());
    assert!(
        repo.link(RowLinkTarget::Company(company), source)
            .await
            .unwrap()
    );
    assert_eq!(
        links
            .list(RowLinkAccess::Entry(
                access(&a, p.id, EntityType::CrmPipeline, OWNER).await,
                first
            ))
            .await
            .unwrap()
            .tables
            .len(),
        2
    );
    links
        .unlink(
            RowLinkAccess::Entry(
                access(&a, p.id, EntityType::CrmPipeline, OWNER).await,
                first,
            ),
            source.row_id,
        )
        .await
        .unwrap();
    links
        .unlink(
            RowLinkAccess::Entry(
                access(&a, p.id, EntityType::CrmPipeline, OWNER).await,
                first,
            ),
            source.row_id,
        )
        .await
        .unwrap();
    assert_eq!(
        links
            .list(RowLinkAccess::Entry(
                access(&a, p.id, EntityType::CrmPipeline, OWNER).await,
                second
            ))
            .await
            .unwrap()
            .tables[0]
            .rows[0]
            .row_id,
        source.row_id
    );
    assert_eq!(
        repo.list(RowLinkTarget::Company(company))
            .await
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        db.storage_row_cells(source.database_id, source.table_id, &[source.row_id])
            .await
            .unwrap()
            .len(),
        1
    );
}
