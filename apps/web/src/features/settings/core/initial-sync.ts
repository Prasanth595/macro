import {
  type BackfillJob,
  BackfillJobStatus,
  type Link,
  SyncStatus,
} from '@service-email/generated/schemas';

/** Whether an inbox has finished its first full sync. */
export function isInitialSyncComplete(
  link: Pick<Link, 'provider' | 'sync_status'>,
  latestBackfill: Pick<BackfillJob, 'status'> | undefined
): boolean {
  return (
    link.sync_status === SyncStatus.UP_TO_DATE &&
    latestBackfill?.status === BackfillJobStatus.Complete
  );
}
