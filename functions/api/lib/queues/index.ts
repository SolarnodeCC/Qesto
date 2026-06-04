/**
 * ADR-042 Phase 2.1: Cloudflare Queues integration
 * Async work queue for post-session tasks (insights, notifications, webhooks)
 *
 * @see producer.ts — enqueue tasks
 * @see consumer.ts — process tasks (runs in queue consumer context)
 */

export { enqueuePostSessionWork, computePayloadHash, type PostSessionWorkMessage } from './producer'
export { processPostSessionWork } from './consumer'
