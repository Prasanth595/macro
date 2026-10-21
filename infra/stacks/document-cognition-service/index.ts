// Durable projection queue retained in its original stack; all consumers and
// periodic refresh sweeps now run inside agent-harness-service.
import { Queue } from '../../packages/resources';
import { stack } from '../../packages/shared';

const aiProjectionQueue = new Queue('ai-projection', {
  tags: {
    environment: stack,
    env: stack,
    tech_lead: 'ehayes',
    project: 'document-cognition-service',
    service: 'document-cognition-service',
  },
  maxReceiveCount: 2,
  visibilityTimeoutSeconds: 120,
});
export const aiProjectionQueueArn = aiProjectionQueue.queue.arn;
export const aiProjectionQueueName = aiProjectionQueue.queue.name;
