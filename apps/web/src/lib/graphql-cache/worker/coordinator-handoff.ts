import type { CacheTelemetryRecorderLike } from '../telemetry';

export const OWNER_HANDOFF_READ_TIMEOUT_MS = 1_000;

/** Bounds read availability, never engine lifetime or physical lock ownership. */
export class CoordinatorHandoff {
  private active: { ownerEpoch: number; startedAt: number } | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private blockedEpoch: number | undefined;

  constructor(
    private readonly options: {
      timeoutMs: number;
      setTimeout: typeof globalThis.setTimeout;
      clearTimeout: typeof globalThis.clearTimeout;
      now: () => number;
      telemetry: CacheTelemetryRecorderLike;
      onBlocked: (ownerEpoch: number) => void;
    }
  ) {}

  get readBlockedEpoch(): number | undefined {
    return this.blockedEpoch;
  }

  start(ownerEpoch: number): void {
    // Churn before a replacement is ready must not keep extending the deadline.
    if (this.active) return;
    const active = { ownerEpoch, startedAt: this.options.now() };
    this.active = active;
    this.options.telemetry.record({
      name: 'graphql_cache.owner',
      operationCategory: 'lifecycle',
      outcome: 'graceful',
      ownerEvent: 'visibility-handoff-started',
    });
    this.timer = this.options.setTimeout(() => {
      this.timer = undefined;
      if (this.active !== active) return;
      this.blockedEpoch = active.ownerEpoch;
      this.options.telemetry.record({
        name: 'graphql_cache.owner',
        operationCategory: 'lifecycle',
        outcome: 'error',
        errorCode: 'timeout',
        ownerEvent: 'visibility-handoff-blocked',
        durationMs: this.options.now() - active.startedAt,
      });
      this.options.onBlocked(active.ownerEpoch);
    }, this.options.timeoutMs);
  }

  ready(): void {
    if (this.active) {
      this.options.telemetry.record({
        name: 'graphql_cache.owner',
        operationCategory: 'lifecycle',
        outcome: 'success',
        ownerEvent: 'visibility-handoff-completed',
        durationMs: this.options.now() - this.active.startedAt,
      });
    }
    this.cancel();
    this.blockedEpoch = undefined;
  }

  cancel(): void {
    if (this.timer !== undefined) this.options.clearTimeout(this.timer);
    this.timer = undefined;
    this.active = undefined;
    // Once reads bypass, only a ready replacement can make them usable again.
  }
}
