# Channel preview browser regression

From `apps/web`, run:

```sh
bunx playwright test --config src/lib/core/component/LexicalMarkdown/component/core/browser-test/playwright.config.ts
```

Install Playwright Chromium first, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`
to an existing Chromium/Chrome executable. `MARKDOWN_PREVIEW_TEST_PORT` overrides
port 3005; the harness owns and stops its Vite server.

The fixture mounts the production wide/narrow channel row content and Home card
layouts over synthetic data. It blocks hosted API traffic. Desktop, tablet touch,
and phone touch checks verify the browser's native accessibility tree, pointer
activation of the owning row, Tab navigation, and interactive conversation links
and mentions. DOM-derived ARIA snapshots do not model `inert`, so accessibility
assertions use Chromium's native CDP tree. This is component integration coverage,
not authenticated app navigation or a VoiceOver session.

Screenshots from the verified fixture: [desktop](proof/desktop.png) and
[phone](proof/mobile.png).

`memory.browser.e2e.ts` mounts the real MarkdownShell twenty times, types into
each editor, and changes input modality after unmount. Retired editors must stop
reading the modality signal. This covers deferred connection through the real
ResizeObserver and runs on the same desktop, tablet, and phone projects. Videos
are saved with the Playwright results; it does not simulate an iOS memory limit.
