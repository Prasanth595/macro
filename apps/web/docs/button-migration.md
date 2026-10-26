# Button migration from UI-lab

## Goal

Replace the existing shared `Button` with the UI-lab implementation on a branch based on `origin/main`. Breaking component API changes are intentional. Do not retain a second Button implementation, compatibility aliases, or legacy prop translation inside the primitive.

Base: `bd1f04dbee3193ae64c006fb29f851c46e06c516`.
Copy source: `experiment/tactile-ui-library` at `1080bdfb86`.

## Implementation

1. Update `components/ui/components/Button.tsx` in place. Keep the existing import path and `@ui` export.
2. Use the lab's semantic materials, explicit icon sizes, optional finishes, loading treatment, and native/headless activation behavior.
3. Keep ButtonGroup composition through the shared group context. The group owns a flat frame without automatic elevation, and buttons inherit its variant and size. Individual Button finishes remain opt-in.
4. Remove the temporary `components/ui/next/` implementation and gallery registration.
5. Migrate affected callers directly to the new API rather than translating old props in Button.
6. Keep examples in the existing `Button.docs.tsx` gallery page.

Only Button-specific helpers and materials are copied. There are no imports from the UI-lab worktree or its debug gallery.

## API changes

- Variants: `primary` (default), `secondary`, `outline`, `ghost`, `accent`, `danger`, `success`, and `link`.
- Use `accent` for the main action: create, save, submit, send, invite, approve, connect, and continue. Keep the shared New launcher (`ViewCreateButton`) neutral with `variant="outline" finish="raised"`; opening a creation menu is not the final create action. Keep `primary` and `secondary` for neutral actions, `ghost` for utility/cancel controls, and `danger` for destructive actions. Do not blindly map legacy `strong` buttons to `secondary`.
- Sizes: `xs` through `xl`, plus `icon-xs` through `icon-xl`. Replace `icon-composer` with `icon-md`.
- Use explicit `icon-*` sizes instead of `square`.
- Set accessible names with `aria-label`, not `label`.
- Tooltips accept a string or `{ content, placement, disabled, hotkey, shortcut }`. Shortcut and tooltip configuration no longer live on the Button root.
- Remove `depth`, `glass`, and `noTouchResize`. Finishes are opt-in through `finish`; `appearance="bare"` leaves the face to a composed control.
- `aria-expanded` drives expanded-state styling, not Kobalte's broader `data-expanded` state.
- Buttons are actions. Navigation uses anchors; the `link` variant is a visual treatment.

Shared wrappers follow the same API: number steppers and split navigation use `aria-label` plus `tooltip`, with shortcut hints inside tooltip options. Split navigation retains default action names and shortcuts, while explicit tooltip options replace those defaults. Number-stepper examples and scheduling controls use the new props directly.

## Theme integration

The lab-only `ui-*` token prefix does not move into the app. Existing `ink`, `ink-muted`, `accent`, `link`, `success`, and `failure` roles remain the palette inputs. New `button-*` roles describe Button-specific fills, edges, and finishes.

Button uses the app's existing typography scale: the standard `md` control uses 14px `text-sm`. No per-button font token remapping or global type-scale changes are introduced. Button keeps the app's 36px minimum touch target.

Solid-accent ink and state tint derive from the effective resolved accent, including theme previews and edits. Derived values do not enter persisted theme data.

The existing theme renderer supplies Button materials at the root and in theme previews. There is no separate Button theme stylesheet, class-targeted material layer, or variant-specific CSS selector. Variants, interaction states, and optional finishes live in the Button recipe.

## Consumer layout follow-up

- Keep ordinary Button children in the root flex row. Do not insert a generic content wrapper: sidebar alignment, trailing carets, label truncation, and custom gaps depend on that row. Only loading-enabled buttons reserve their content in a separate layer.
- Put icon sizing on each rendered icon, including icons supplied through shared wrappers. Do not size button icons through descendant SVG selectors. Preserve explicit glyph sizes and touch sizes when migrating callers.
- Use the standard `size-8` and `min-h-8` utilities for medium controls so caller placement classes merge predictably. The app rail retains its 40px buttons and 20px navigation glyphs.
- Keep medium labeled controls at 32px with 8px horizontal padding. ButtonGroup owns its shared frame and keeps segments inside that frame, including dividers and vertical groups.
- Wrap ordinary dropdown action lists in `Dropdown.Group` so they receive the shared menu inset. CRM creation/pipeline menus and routine action menus now follow that structure.
- Keep the Tasks New menu inside a padded `Dropdown.Group`, with gaps between creation actions. Pass Share's tooltip to `HeaderActionButton` directly so no extra wrapper interrupts its full-height group segment.
- Use ghost styling for task composer expand, attach, close, and clear-draft actions, search clear/close, and split close controls. Task creation and the share menu's submit action use accent styling; split close controls use compact icon sizing.
- Project creation follows the task composer's control hierarchy: ghost `icon-md` expand/close actions, secondary `xs` Clear Draft and property pills, a compact sharing toggle, and an accent `sm` Create Project action. Both composers keep the shared EntityComposer layout and existing draft/submission behavior.
- Project overview properties use the task view's wrapping row and secondary `xs` pills. Keep the project's current status, priority, assignee, and due-date fields, ordering, permissions, and editors; do not import task-specific state or hide project fields.
- Email composer and reply utility actions (discard, attach, formatting, Cc/Bcc, Back, and schedule controls) use ghost styling; Send stays accent-styled. Reply trash and attachment icons have explicit 16px desktop / 24px touch sizing while preserving their button hit areas.
- Folder creation keeps expand and close as ghost utility actions; the final Create Folder action retains its accent treatment.
- Search clear/close buttons use ghost `icon-xs` controls with 14px desktop icons; the Button touch minimum remains unchanged.
- View-sidebar Show/Hide controls use ghost styling with no persistent active fill while the sidebar is open.
- Size the icon-only Add tag trigger with `buttonClasses({ variant: 'outline', size: 'icon-sm' })`; do not combine a labeled badge size with a narrower width override.
- Task composer and inline document/task properties use secondary `xs` pills, including tags and Add property. Keep size configurable in shared property/tag helpers; other property consumers retain their existing variants and sizes.
- Kanban Load more actions use outline styling, both within a task column and below the board.

## Caller variant audit

Omitted variants were reviewed by action role without changing Button's global default. Utility, navigation, dismiss, and local remove actions now use ghost; final submit actions use accent; neutral launchers and pagination use outline. Permanent membership removals use danger. Caller-controlled pass-through wrappers and unconditional ButtonGroup inheritance remain intact. Header actions explicitly use ghost because their group frame disappears on touch devices. Existing sizes and handlers are unchanged by the variant audit. Checks and browser verification remain paused.

## Development and validation

The dev server runs from this worktree on port 3007 with HTTPS disabled and the existing hosted development API proxy enabled. Known hosted API and WebSocket requests use same-origin `/__macro_dev/` forwarding; backend CORS policies remain unchanged. It reuses the existing local dependency directory; no dependencies were downloaded. Start it with:

```sh
MACRO_DEV_HTTPS=false MACRO_DEV_PROXY=true PORT=3007 bun run dev:server --strictPort
```

Proxy forwarding was enabled after CORS errors were reported. The failing response was not captured, so this is a development transport workaround rather than a confirmed endpoint-level diagnosis.

Checks, builds, tests, formatting, browser verification, probes, and hooks remain paused. The implementation and caller migration are unverified. Starting the server does not establish rendering, type, accessibility, or interaction correctness.
