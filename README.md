# Readable agent task-list proof

Captured in a private headless Chromium with desktop and iPhone 13 touch contexts.
No shared browser, production data, or signed-in account was used.

The fixture uses the real CollectionCard and dynamic-ui layout components with
sample titles and metadata. After screenshots use the production TaskResultRow.
Before screenshots isolate the unchanged task branch of the base WideLayout
component and the base dynamic-ui Layout: backend-dependent entity display slots
are supplied by fixture title/icon/metadata/timestamp values. These screenshots
show the old layout with deterministic sample data, not a hosted user session.

Widths: 1100px results in a 1280px desktop viewport, 480px results in a 1280px
split simulation, and phone width with touch. Long and unbroken titles lose no
text or horizontal space after the fix. A short title retains a 44px touch target.

Live fixture: https://wolf-macro-google:3188/
