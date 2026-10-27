# Entity

App-local entity feature code, including composable entity rendering,
domain-specific extractors, editing surfaces, query and mutation adapters, and
search/notification adapters. The `@entity` alias is the feature's public
app-local entry point.

`ListEntity` accepts a caller-owned `footer` slot below its responsive content.
Use it for supplementary row details without replacing the standard row layout;
interactive footer controls own their events so they do not open the parent item.
