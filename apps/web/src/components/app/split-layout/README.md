Split layout should support an arbitrary number of vertical splits.

## Session view restoration

`SplitLayoutProvider` owns `ViewSessionProvider` above the app chrome and pane
content. Ordinary app navigation uses its `openView` / `replaceView` actions,
which remember the last focused location and captured entry state per view.
The record is memory-only and account-scoped; views still unmount normally.
Explicit links and new-split actions do not consult this record. Native dock
navigation still resets the pane stack, and dock Search starts a fresh session.

Views retain local context through `useEntryState` or
`registerEntryStateCaptor`. The same slices now restore both through pane
Back/Forward and through global app switches. Route/schema state stays separate
from these opaque runtime slices. Restores run through the existing router so
leave guards, middleware, URL updates, and single-owner content claims still apply.

The remaining notes below describe the original split layout.


SplitLayoutRouter is responsible for handling the routing of the splits.

url schema stays the same `app/<split_type>/<split_id>/<split_type>/<split_id>`


a `split_type` can either be a `BlockName` or the string literal `component`

`components` should get resolved by a `ComponentRegistry`

`resolveComponent` should resolve a component by its name, and parameters

`BlockOrchestrator` owns creating and destroying the blocks themselves.

`Blocks` can exist either mounted to a layout, another block, or completely detached

`LayoutManager` owns the layout state, which is managed through the url

`LayoutManager` must exist within the tree of a SolidRouter, while `BlockOrchestrator` can exist outside of it.

`LayoutManager::insertSplit(splitContent?: SplitContent)` should insert a new split into the layout, and return a `LayoutSplit` object handle to manage the split

Composable utilities should tie them together.

`LayoutManager::getSplit()` should return a `LayoutSplit` object which you can use to navigate the splits back and forth.

Each split should have a `SplitContext` with its own `LayoutSplit` object handle to manaipulate its own split

`LayoutSplit::goBack()` and `LayoutSplit::goForward()` should navigate the split back and forth

`LayoutSplit::replace(splitContent: SplitContent)` should replace the current split content with a new one, this will automatically apply to the splits history

TODO:
- [x] figure out what is wrong with split history. It will occasionally not work as expected
- [x] replace existing usages of blockLayout with the layoutManager
- [x] figure out some clean alternative to a global layout manager. Maybe passing it through context?
- [x] wrap all non block components with a SplitLayout Top Bar tha thas all the navigation buttons
- [x] port over nested block implementation to use block orchestrator
- [x] add a temporary settings menu to the global bottom bar
- [x] disable the right bar for now.
- [x] port over BlockRoute to the new SplitRoute
- [ ] fix instances of stripOtherBlocksFromUrl

Things that might be broken
- command menu will always open things in a new split
- query params are broken
- Browser history changes won't live update
- Right hand side panel has been temporarily removed
- No way to see channel notifications.

TODO AFTER:
- [ ] better resizing for panels, should resize based on the existing ratio
- [ ] need a split dialog (a dialog that is centered on the split)
- [ ] useBeforeLeave won't work as expected going forward, since we use the split layout as the source of truth.
      Lots of places use `isLeavingCurrentBlock` to run some side effects, we need to abstract this under the split
      Might need something like `useBeforeSplitClose` or `useBeforeBlockClose`
