# Macro Web App

This Pulumi stack publishes `apps/web/dist` under `/app/` in S3 and provides
origins to the `website-infra` CloudFront distribution.

## Deployment

Build from `apps/web` with `just build-dev`, then use this package's
`bun run deploy:dev` when a dev deployment is authorized. See the
[infrastructure guide](../../../docs/development/infrastructure.md) for deployment rules.

The stack retains ten builds of hashed assets for open tabs and publishes a
separate archive for native updates. Keep both independent of service-worker
retirement.

After publishing, dev invalidates `/app/sw.js` and production retains its full
`/app` and `/app/*` invalidation. Both wait for completion so cached copies of
the former service worker cannot delay retirement.
