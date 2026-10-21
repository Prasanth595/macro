---
description: "Controls come from one component per role, at one height per bar, with one selected state, styled only by their own props."
paths:
  - "apps/web/src/**/*.tsx"
globs: "apps/web/src/**/*.tsx"
alwaysApply: false
---

# Compose controls from the design system

The app looks inconsistent when a surface invents its own switcher, frames
tabs as actions, or resizes a control from the outside. Like Linear, every bar
uses the same few controls in the same places, so a new surface looks right by
construction. Browse them at `/app/component/ui` (Foundations → Controls).

| Role | Use | Never |
| --- | --- | --- |
| Switch a view, section, or one of a few values (`wrap` for preset chips in forms) | `Tabs` | Buttons, a ButtonGroup, or an island acting as tabs |
| Tabs that own panels or a dynamic collection (tables, form pages, rename, add) | `TabSelector` (`Root`, `List`, `Tab`, `Panel`, `AddMenu`) | `@kobalte/core/tabs` in a feature |
| Related header actions (filters, view options, sharing, navigation) | `HeaderActionGroup` | A hand-built bordered row |
| One on/off toggle, or an icon-only layout choice | `Button` with `aria-pressed` | A custom active tint |
| Many options, or header tabs that no longer fit | `Dropdown` / `Select`, or `Tabs iconOnly` first | Scrolling or wrapping a header tab row |
| Create, search in a collection header | `ViewCreateButton`, `ListHeaderSearch` | One-off New or search buttons |
| Text entry, search fields | `Input`, `InputGroup`, `SearchBar`, `settings-input` | A raw `<input>` with its own border, radius, or focus color |

- **FE-58** Pick the component for the role from the table above, and import
  tabs only from `@ui`. Enforced by ast-grep `tsx-tabs-from-ui`, CI error; the
  Fig editor's panel tabs and the mobile share sheet's `UnderlineTabs` are the
  documented exceptions.
- **FE-59** Tabs are navigation and islands are actions: never put `Tabs` or
  `TabSelector` inside a `HeaderActionGroup` or `ButtonGroup`, and never render
  a tab as a `Button`. Enforced by ast-grep `tsx-tabs-not-in-action-group` and
  `tsx-no-button-as-tab`, CI error.
- **FE-60** Lay out a desktop header as one row: title or breadcrumbs, then
  view tabs on the left; islands on the right in the order filters, view
  options, New, Search (detail views: entity actions, sharing, navigation,
  detail toggle). Every control in the row is 32px: `Tabs` `md`, `icon-md` for
  icon-only buttons (16px glyph), `md` for labelled ones (14px glyph), 8px
  between islands. Filter, sort, group, and download live in the header, never
  in a second toolbar row; only active filter chips sit below it.
- **FE-61** Style controls only through their props (`variant`, `size`,
  `fullWidth`, `iconOnly`); `class` on a control is for placement (margin,
  width, order, shrink). Never resize or recolor a control from a wrapper
  (`[&_button]:size-8`), and don't use `square` for new icon buttons. Enforced
  for wrappers by ast-grep `tsx-no-descendant-button-styles`, warning.
- **FE-62** Keep one selected state: a selected tab and a pressed button share
  the pressed fill, flat; unselected options keep the outline Button frame. No
  accent text, underlines, or bespoke tints for selection on desktop.
- **FE-63** Components own their touch treatment. Never branch on
  `isTouchDevice()` to choose a tab component or variant; set `Tabs`' `touch`
  to the style that surface already uses on touch.
- **FE-64** Single-line inputs are pills at the control heights, like Buttons:
  build them from `Input`, `InputGroup`, or `SearchBar` (`settings-input` in
  settings rows). Filter chips use the same frame (pill, `edge-button` border,
  control fill) with `overlay-*` hovers, never raw `ink/5` tints.

Check: `just check` passes the ast-grep rules; the changed bar shows one height,
16px icon glyphs, tabs on the left, and islands only around actions, at desktop
width and narrowed until labels collapse.
