use std::collections::{HashMap, HashSet};

use entity_access::domain::models::EntityAccessAuth;

use super::reads::FakeResources;
use super::*;
use crate::domain::reads::{
    DescriptionReader, InitiativePropertySnapshot, ProfileName, TaskOverview,
};

const ASSIGNEE: &str = "macro|assignee@macro.com";
const TASK_ASSIGNEE: &str = "macro|task-assignee@macro.com";
const HIDDEN_ASSIGNEE: &str = "macro|hidden-assignee@macro.com";

fn anonymous_receipt() -> EntityAccessReceipt<ViewAccessLevel> {
    EntityAccessReceipt::try_new(
        EntityAccessAuth::Unauthenticated,
        Entity {
            entity_id: initiative_id().to_string(),
            entity_type: EntityType::Initiative,
        },
        EntityPermission::AccessLevel {
            access_level: AccessLevel::View,
        },
    )
    .expect("view satisfies the receipt")
}

fn assigned(ids: &[&str]) -> InitiativePropertySnapshot {
    InitiativePropertySnapshot {
        assignees: ids.iter().map(|id| id.to_string()).collect(),
        ..Default::default()
    }
}

fn profile(id: &str, first: &str) -> ProfileName {
    ProfileName {
        id: id.to_string(),
        first_name: Some(first.to_string()),
        last_name: None,
    }
}

fn detail_repo() -> MockInitiativeRepo {
    let mut repo = MockInitiativeRepo::new();
    repo.expect_get_detail()
        .times(1)
        .return_once(|_| Box::pin(async { Ok(Some(detail(Vec::new()))) }));
    repo
}

fn overview_service(
    repo: MockInitiativeRepo,
    surfaces: MockInitiativeDescriptionSurfaces,
    resources: FakeResources,
) -> TestService {
    InitiativeServiceImpl::new(repo, surfaces, std::sync::Arc::new(resources))
}

fn empty_description() -> MockInitiativeDescriptionSurfaces {
    let mut surfaces = MockInitiativeDescriptionSurfaces::new();
    surfaces
        .expect_reader()
        .withf(|initiative| *initiative == initiative_id())
        .times(1)
        .return_once(|_| Box::pin(async { Ok(DescriptionReader::Empty) }));
    surfaces
}

#[tokio::test]
async fn overview_lists_visible_tasks_with_their_names_properties_and_people() {
    let status = uuid::Uuid::from_u128(50);
    let priority = uuid::Uuid::from_u128(60);
    let project = InitiativePropertySnapshot {
        status: Some(status),
        ..assigned(&[ASSIGNEE])
    };
    let open = InitiativePropertySnapshot {
        priority: Some(priority),
        ..assigned(&[TASK_ASSIGNEE])
    };
    let done = InitiativePropertySnapshot {
        completed: true,
        ..assigned(&[ASSIGNEE])
    };
    let mut repo = detail_repo();
    repo.expect_task_names()
        .withf(|ids| ids == &["open".to_string(), "done".to_string()])
        .times(1)
        .return_once(|_| {
            Box::pin(async {
                Ok(HashMap::from([
                    ("open".to_string(), "Write the brief".to_string()),
                    ("done".to_string(), "Pick a date".to_string()),
                ]))
            })
        });
    repo.expect_profile_names()
        .withf(|ids| {
            ids.iter().cloned().collect::<HashSet<_>>()
                == HashSet::from([OWNER, ASSIGNEE, TASK_ASSIGNEE].map(String::from))
                && ids.len() == 3
        })
        .times(1)
        .return_once(|_| {
            Box::pin(async { Ok(vec![profile(ASSIGNEE, "Ada"), profile(OWNER, "Olive")]) })
        });
    let svc = overview_service(
        repo,
        empty_description(),
        FakeResources {
            denied: HashSet::from(["hidden".into()]),
            tasks: vec!["open".into(), "hidden".into(), "done".into()],
            values: HashMap::from([
                (initiative_id().to_string(), project.clone()),
                ("open".into(), open.clone()),
                ("done".into(), done.clone()),
                ("hidden".into(), assigned(&[HIDDEN_ASSIGNEE])),
            ]),
            ..Default::default()
        },
    );

    let overview = svc.overview(view_receipt()).await.unwrap();

    assert_eq!(overview.summary.initiative.name, "Launch");
    assert_eq!(overview.summary.properties, project);
    assert_eq!(overview.summary.task_count, 2);
    assert_eq!(overview.summary.completed_task_count, 1);
    assert_eq!(overview.owner_id, user(OWNER));
    assert_eq!(
        overview.tasks,
        [
            TaskOverview {
                id: "open".into(),
                name: "Write the brief".into(),
                properties: open,
            },
            TaskOverview {
                id: "done".into(),
                name: "Pick a date".into(),
                properties: done,
            },
        ]
    );
    assert_eq!(
        overview.people,
        [profile(ASSIGNEE, "Ada"), profile(OWNER, "Olive")]
    );
    assert_eq!(overview.description, DescriptionReader::Empty);
}

#[tokio::test]
async fn overview_serves_a_signed_out_reader_without_creating_the_description() {
    let mut repo = detail_repo();
    repo.expect_task_names().times(1).return_once(|_| {
        Box::pin(async { Ok(HashMap::from([("public".into(), "Read me".into())])) })
    });
    repo.expect_profile_names()
        .times(1)
        .return_once(|_| Box::pin(async { Ok(Vec::new()) }));
    let mut surfaces = MockInitiativeDescriptionSurfaces::new();
    surfaces.expect_reader().times(1).return_once(|_| {
        Box::pin(async {
            Ok(DescriptionReader::Live {
                token: "grant".into(),
            })
        })
    });
    let svc = overview_service(
        repo,
        surfaces,
        FakeResources {
            tasks: vec!["public".into()],
            ..Default::default()
        },
    );

    let overview = svc.overview(anonymous_receipt()).await.unwrap();

    assert_eq!(overview.summary.user_access_level, ShareAccessLevel::View);
    assert_eq!(
        overview.tasks,
        [TaskOverview {
            id: "public".into(),
            name: "Read me".into(),
            properties: InitiativePropertySnapshot::default(),
        }]
    );
    assert!(overview.people.is_empty());
    assert_eq!(
        overview.description,
        DescriptionReader::Live {
            token: "grant".into()
        }
    );
}

#[tokio::test]
async fn description_reader_serves_a_signed_out_reader_without_creating_the_description() {
    let mut surfaces = MockInitiativeDescriptionSurfaces::new();
    surfaces
        .expect_reader()
        .withf(|initiative| *initiative == initiative_id())
        .times(1)
        .return_once(|_| {
            Box::pin(async {
                Ok(DescriptionReader::Live {
                    token: "grant".into(),
                })
            })
        });

    let reader = service_with(MockInitiativeRepo::new(), surfaces)
        .description_reader(anonymous_receipt())
        .await
        .unwrap();

    assert_eq!(
        reader,
        DescriptionReader::Live {
            token: "grant".into()
        }
    );
}

#[tokio::test]
async fn description_reader_rejects_other_receipts() {
    let document_receipt: EntityAccessReceipt<ViewAccessLevel> =
        receipt(OWNER, EntityType::Document, AccessLevel::View);
    assert!(matches!(
        service(MockInitiativeRepo::new())
            .description_reader(document_receipt)
            .await,
        Err(InitiativeError::BadRequest(_))
    ));
}
