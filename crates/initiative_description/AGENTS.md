# initiative_description

## What it is

Part of Tasks and projects: the adapter that stores an initiative's
description on a collab surface with the initiative's id, parented by the
initiative. It implements the initiative domain's
`InitiativeDescriptionSurfaces` port over `OwnedSurfaceService`.

## Start here

- `src/lib.rs`: the adapter and how collab-surface errors map to
  `InitiativeError`.

## Scope

- Owns: translating description calls (ensure, read, reader grant, retire) into
  owned-surface calls.
- Not here: who may read or edit a description → `crates/initiative`; surface
  lifecycle and token minting → `crates/collab_surface`.

## Boundaries

- Depends on: `initiative` (ports), `collab_surface` (ports).
- Used by: `document_storage_service` and `ai_tools`, which build it at their
  composition roots.

## Checks

- `cargo test -p initiative_description`

## Gotchas

- Every call is already authorized by the initiative domain. Never call it from
  an inbound handler.
- `reader` never creates the surface: a description no one has opened is
  `DescriptionReader::Empty`.

## Related

- Skill: `.agents/skills/collab-surface-core/SKILL.md`
