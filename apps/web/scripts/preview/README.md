# Web previews

`deploy.ts` publishes a build to `macro-preview-assets-dev` under a preview ID.
Repeated deployments reuse that preview hostname.

Keep hashed assets on the immutable sync path. Publish `sw.js` separately with
`Cache-Control: no-store`, then invalidate both `/app/sw.js` and the
preview-prefixed worker path before pruning old WASM artifacts.

The deploy identity needs CloudFront `ListDistributions`, `CreateInvalidation`,
and `GetInvalidation` permissions in addition to its existing S3 permissions.
The script discovers the shared distribution by its preview-bucket origin and
fails if the result is missing or ambiguous. It waits for invalidation before
reporting the preview ready. Tests inject command responses and never contact AWS.

Run `bun run test --project scripts scripts/preview/preview.test.ts` from
`apps/web`. Follow the [infrastructure deployment rules](../../../../docs/development/infrastructure.md)
before running a deployment.
