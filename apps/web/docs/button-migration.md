# Button redesign

## Goal

Redesign the existing shared `Button` in place. Breaking component API changes are intentional. Do not retain a second Button implementation, compatibility aliases, or legacy prop translation inside the primitive.

## Implementation

1. Update `components/ui/components/Button.tsx` in place. Keep the existing import path and `@ui` export.
2. Use semantic materials, explicit icon sizes, optional finishes, loading treatment, and native/headless activation behavior.
3. Use explicit `ButtonGroup.Button` composition. Ordinary Buttons remain independent. Share Button's frame materials and finishes; existing groups opt into `variant="secondary" finish="raised"`. Migrate headless triggers and action wrappers to explicit grouped controls.
4. Remove the temporary `components/ui/next/` implementation and gallery registration.
5. Migrate affected callers directly to the new API rather than translating old props in Button.
6. Keep examples in the existing `Button.docs.tsx` gallery page.

Keep Button-specific helpers and materials within the app's shared UI and theme modules.

## API changes

- Variants: `primary` (default), `secondary`, `outline`, `ghost`, `accent`, `danger`, `success`, and `link`.
- Use `accent` for the main action: create, save, submit, send, invite, approve, connect, and continue. Keep the shared New launcher (`ViewCreateButton`) neutral with `variant="secondary" finish="raised"`; opening a creation menu is not the final create action. Keep `primary` and `secondary` for neutral actions, `ghost` for utility/cancel controls, and `danger` for destructive actions. Do not blindly map legacy `strong` buttons to `secondary`.
- Secondary uses a transparent border in its plain, raised, and gradient-raised states. Keep fills, shadows, geometry, and keyboard focus unchanged. The outline variant and explicit glass-outline finish retain their borders.
- Sizes: `xs` through `xl`, plus `icon-xs` through `icon-xl`. Replace `icon-composer` with `icon-md`.
- Use explicit `icon-*` sizes instead of `square`.
- Set accessible names with `aria-label`, not `label`.
- Tooltips accept a string or `{ content, placement, disabled, hotkey, shortcut }`. Shortcut and tooltip configuration no longer live on the Button root.
- Remove `depth`, `glass`, and `noTouchResize`. Finishes are opt-in through `finish`; `appearance="bare"` leaves the face to a composed control.
- `aria-expanded` drives expanded-state styling, not Kobalte's broader `data-expanded` state.
- ButtonGroup uses a compound API: `ButtonGroup.Button` inherits group size and variant; standalone Button remains independent. Frame colors and finishes reuse Button's recipe without adding whole-group hover states. Segments retain their own hover, pressed, disabled, and focus states.
- Group roots use native `aria-label` rather than `label`, and no longer accept `depth`. Existing action groups use `variant="secondary" finish="raised"`; omitting `finish` keeps the plain frame. CopyButton opts into a segment with `as={ButtonGroup.Button}`.
- CopyButton uses its polymorphic `as` prop for composition. HeaderActionButton, list/filter/group/sort menus, and email controls expose `grouped`. Custom `BlockTool.buttonComponent` callbacks receive the same option. A segment outside a group keeps ordinary Button styling, preserving frame-free touch layouts.
- HeaderActionGroup defaults to `sm` sizing with a minimum-height frame and accepts `size="md"`. Grouped labelled actions inherit the frame size. Header frames and the task document's split action omit the transparent border so it does not add 2px around their segments. The task split action uses `sm`/`icon-sm`, including when its label collapses. Calendar navigation and view selectors retain compact header sizing. Keep standalone New/Search controls and touch targets unchanged.
- Email header groups currently trial `md` / `icon-md` (32px), including filters, reading-pane controls, reminders, read/done actions, Ask Macro, Create task, sharing, navigation, and the details toggle. Icon dimensions remain unchanged. Email icon actions pass their size through `HeaderActionButton`, which omits the visible label while retaining its accessible name and tooltip; header wrappers do not resize or pad descendant buttons. Touch controls retain their existing behavior.
- The email inbox trigger centers its avatar or overlapping avatar group in a fixed icon slot without shrinking the avatars or changing its button hit area.
- Portaled email actions own their `HeaderActionGroup`; the outlet must not add a second frame, because portal content retains its original context.
- Buttons are actions. Navigation uses anchors; the `link` variant is a visual treatment.

Shared wrappers follow the same API: number steppers and split navigation use `aria-label` plus `tooltip`, with shortcut hints inside tooltip options. Split navigation retains default action names and shortcuts, while explicit tooltip options replace those defaults. Number-stepper examples and scheduling controls use the new props directly.

Tooltips share one implementation in `components/ui/components/Tooltip.tsx`: the assembled wrapper and compound `Root`, `Trigger`, `Portal`, and `Content` parts use the same policy and presentation. Button composes the parts around its own trigger. Trigger disposal closes the popup through lifecycle cleanup, without observing document-wide mutations. Use string tooltip shorthand when only content is needed; use an options object for placement, shortcuts, or disabled state, without redundant fallbacks.

Group controls explicitly instead of relying on descendant selectors:

```tsx
<ButtonGroup variant="secondary" finish="raised" size="sm" aria-label="Actions">
  <ButtonGroup.Button>Run</ButtonGroup.Button>
  <ButtonGroup.Divider />
  <Dropdown.Trigger as={ButtonGroup.Button} variant="secondary" size="icon-sm" aria-label="Run options">
    <CaretDownIcon class="size-4" />
  </Dropdown.Trigger>
</ButtonGroup>
```

## Theme integration

Use the app's semantic tokens without an additional prefix. Existing `ink`, `ink-muted`, `accent`, `link`, `success`, and `failure` roles remain the palette inputs. New `button-*` roles describe Button-specific fills and finishes; neutral borders use shared roles instead of a button-only token.

Button uses the app's existing typography scale: labeled and icon sizes map `xs` → `text-xs`, `sm` → `text-sm`, `md` → `text-sm` (14px), `lg` → `text-base` (15px), and `xl` → `text-xl`. No per-button font token remapping or global type-scale changes are introduced. Labeled buttons combine minimum height with vertical padding: xs/sm/md use `py-0.5`, lg uses `py-1`, and xl uses `py-2`. Their minimum heights are 24/28/32/40/48px, respectively; icon variants use matching square dimensions with zero padding. Content can increase labeled height; do not clamp labeled buttons with a fixed height. Explicit glyph sizing and the app's 36px minimum touch target remain independent.

Tabs reuse Button's height, typography, and icon size classes for `xs` through `xl`; icon-only options use the matching square size. Desktop options share the incoming rounded track with an inset selected pill, while wrapping presets remain separate pills. Tab treatments stay flat: use ordinary borders and selected fills without elevated edges, gradients, or shadows, including the composer track and touch inset. Tab labels own the padding so their clickable and selected surfaces fill each pill. Medium labeled tabs use 12px horizontal padding and `text-sm` (14px); large labeled tabs use `text-base` (15px). Other label sizes, minimum heights, and vertical padding keep the Button scale. The agent-composer `track` keeps its fixed sizing. Touch pill, inset, segmented, and separate-pill treatments retain their minimum targets; touch floors and inset or segmented frames can make the rendered control taller than a same-size Button. `fullWidth` stretches labeled options; icon-only options stay square. ChannelDetailTabs and Email Signal/Noise tabs use `md`.

Button materials live in `src/index.css`: fills, hover/pressed colors, borders, and optional finish shadows use the existing palette inputs and reset at every `[data-theme-light]` scope. Light and dark previews resolve their own materials rather than inheriting a parent theme's computed values. Keep appearance changes in CSS, not in the theme renderer.

`buttonAccentVars` in `features/theme/utils/buttonTheme.ts` only chooses contrasting solid-accent text and its inverse state tint from the resolved accent. The root renderer and subtree previews supply those two variables; all mixing remains in CSS. Live color edits also refresh the existing light/dark scope marker. Derived values do not enter persisted theme data.

Shared neutral borders use `border-primary`, `border-secondary`, `border-tertiary`, and `divider`: 16%, 12%, 8%, and 4% opacity respectively, white in dark mode and black in light mode. Outline Buttons use `border-border-secondary` in both modes. Secondary Buttons and their shared ButtonGroup frame use that border only in light mode; dark mode keeps transparent border geometry. Dark secondary raised finishes keep the contact shadow without the perimeter, and glass-outline reflections are hidden. Group separators retain `bg-divider`. The optional light raised perimeter also uses the secondary role. These CSS tokens reset on every theme scope and stay independent of text colors; existing `edge-*` consumers and focus/status treatments are unchanged. This replaces the button-only dark-border experiment without broadening the migration to unrelated controls.

The Create menu's monochrome submit action uses the shared `primary` variant so its background and text contrast stay paired; do not locally override accent colors while leaving the derived accent text unchanged.

This keeps the current button materials without a second JavaScript material recipe. Variants, interaction selectors, and optional finish selection remain in the shared Button recipe. Checks and visual review remain paused.

## Consumer layout follow-up

- Keep ordinary Button children in the root flex row. Do not insert a generic content wrapper: sidebar alignment, trailing carets, label truncation, and custom gaps depend on that row. Only loading-enabled buttons reserve their content in a separate layer.
- Put icon sizing on each rendered icon, including icons supplied through shared wrappers. Do not size button icons through descendant SVG selectors. Preserve explicit glyph sizes and touch sizes when migrating callers.
- Use the standard `size-8` and `min-h-8` utilities for medium controls so caller placement classes merge predictably. The app rail retains its 40px buttons and 20px navigation glyphs.
- Keep medium labeled controls at a 32px minimum with 8px horizontal and 2px vertical padding. ButtonGroup owns its shared frame; labeled groups use minimum heights and stretch their segments so padded content can grow without clipping. Icon-only group dimensions remain fixed.
- Channel header and Email Signal/Noise tabs use flat `md` pills with 14px text and 12px horizontal padding. The desktop channel strip retains its measured 4px end gutter for clipping clearance; the gutter is desktop-only.
- Wrap ordinary dropdown action lists in `Dropdown.Group` so they receive the shared menu inset. CRM creation/pipeline menus and routine action menus now follow that structure.
- Keep the Tasks New menu inside a padded `Dropdown.Group`, with gaps between creation actions. Pass Share's tooltip to `HeaderActionButton` directly so no extra wrapper interrupts its full-height group segment.
- Task composer expand and close use ghost `icon-md` controls with 16px icons; Clear Draft uses secondary `xs`. Attach, search clear/close, and split close remain ghost utilities. Task creation and the share menu's submit action use accent styling; split close controls use compact icon sizing.
- Project creation follows the task composer's control hierarchy: ghost `icon-md` expand/close actions, secondary `xs` Clear Draft and property pills, a compact sharing toggle, and an accent `sm` Create Project action. Both composers keep the shared EntityComposer layout and existing draft/submission behavior.
- Project overview properties use the task view's wrapping row and secondary `xs` pills. Keep the project's current status, priority, assignee, and due-date fields, ordering, permissions, and editors; do not import task-specific state or hide project fields.
- Email composer and reply utility actions (discard, attach, formatting, Cc/Bcc, Back, and schedule controls) use ghost styling; Send stays accent-styled. Reply trash and attachment icons have explicit 16px desktop / 24px touch sizing while preserving their button hit areas.
- Folder creation keeps expand and close as ghost utility actions; the final Create Folder action retains its accent treatment.
- Search clear/close buttons use ghost `icon-xs` controls with 14px desktop icons; the Button touch minimum remains unchanged.
- View-sidebar Show/Hide controls use ghost styling with no persistent active fill while the sidebar is open.
- Keep side-panel Add tags, Add property, and duplicate Dismiss / Dismiss all actions at `xs` (24px minimum height, `text-xs`); use `icon-xs` for the icon-only Add tags trigger. Let the shared size recipe own height, padding, and typography instead of fixed-height overrides. Preserve the shared touch minimum and other property/tag consumers' sizes.
- Property pills default to `xs` so editable and read-only values use 12px (`text-xs`) text. Task composer and inline document/task properties use secondary `xs` pills, including tags and Add property. Keep explicit size overrides configurable; generic badge defaults and property variants stay unchanged.
- Property value and tag pills group the leading icon/value with a 4px gap; carets retain their separate trailing spacing. Add property uses the same compact gap. Existing pill padding is preserved. The task composer attachment row stays inside the clipped main area without a negative left margin; button sizes and hit areas are unchanged.
- Kanban Load more actions use outline styling, both within a task column and below the board.

Calendar notes, calendar attachments, shared-event actions, and file-download controls use the same Button API. Preserve provider permissions, invitation gating, focus restoration, and download callbacks when adapting these controls.

## Caller variant audit

Omitted variants were reviewed by action role without changing Button's global default. Utility, navigation, dismiss, and local remove actions now use ghost; final submit actions use accent; neutral launchers and pagination use outline. Permanent membership removals use danger. Caller-controlled pass-through wrappers remain intact; group inheritance now requires explicit `ButtonGroup.Button` composition. Header actions explicitly use ghost because their group frame disappears on touch devices. Existing sizes and handlers are unchanged by the variant audit. Checks and browser verification remain paused.

## Development and validation

The dev server runs from this worktree on port 3007 with HTTPS disabled and the existing hosted development API proxy enabled. Known hosted API and WebSocket requests use same-origin `/__macro_dev/` forwarding; backend CORS policies remain unchanged. It reuses the existing local dependency directory; no dependencies were downloaded. Start it with:

```sh
MACRO_DEV_HTTPS=false MACRO_DEV_PROXY=true PORT=3007 bun run dev:server --strictPort
```

Proxy forwarding was enabled after CORS errors were reported. The failing response was not captured, so this is a development transport workaround rather than a confirmed endpoint-level diagnosis.

Targeted CI-repair validation covers TypeScript, Biome, and affected unit suites. Browser verification and a full local build remain unperformed; starting the preview does not establish visual correctness.
