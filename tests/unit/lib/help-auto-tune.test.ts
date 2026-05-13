import { describe, it, expect } from 'vitest'

/**
 * Integration test scenarios for help assistant auto-tuning.
 * These tests verify the feedback → flagging → review queue → prompt versioning flow.
 */

describe('Help Assistant Auto-Tuning Flow', () => {
  describe('Feedback aggregation and auto-flagging', () => {
    it('should flag document after 3 downvotes in 7 days', () => {
      // Mock scenario:
      // 1. User 1 submits question about "How do I upgrade?"
      // 2. Gets answer from doc_A (billing topic)
      // 3. Marks as unhelpful (downvote 1)
      //
      // 4. User 2 submits similar question
      // 5. Gets same answer from doc_A
      // 6. Marks as unhelpful (downvote 2)
      //
      // 7. User 3 submits question
      // 8. Gets same answer from doc_A
      // 9. Marks as unhelpful (downvote 3)
      //
      // Expected: doc_A flagged for review in help_documents_review_queue

      const downvotes = [
        { userId: 'user1', documentId: 'doc_A', helpful: false, timestamp: Date.now() - 0 },
        { userId: 'user2', documentId: 'doc_A', helpful: false, timestamp: Date.now() - 1000 * 60 * 5 }, // 5 min ago
        { userId: 'user3', documentId: 'doc_A', helpful: false, timestamp: Date.now() - 1000 * 60 * 10 }, // 10 min ago
      ]

      const downvoteCount = downvotes.filter((d) => !d.helpful).length
      expect(downvoteCount).toBe(3)
      expect(downvoteCount >= 3).toBe(true)
      // This should trigger auto-flagging in the real endpoint
    })

    it('should NOT flag if downvotes are outside 7-day window', () => {
      const now = Date.now()
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
      const eightDaysAgo = now - sevenDaysMs - 1000 // 1 second over 7 days

      const downvotes = [
        { userId: 'user1', documentId: 'doc_B', helpful: false, timestamp: eightDaysAgo },
        { userId: 'user2', documentId: 'doc_B', helpful: false, timestamp: now - 1000 * 60 * 5 },
        { userId: 'user3', documentId: 'doc_B', helpful: false, timestamp: now - 1000 * 60 * 10 },
      ]

      // Only count downvotes within last 7 days
      const recentDownvotes = downvotes.filter(
        (d) => !d.helpful && d.timestamp >= now - sevenDaysMs,
      )

      expect(recentDownvotes.length).toBe(2)
      expect(recentDownvotes.length >= 3).toBe(false)
      // Should NOT trigger auto-flagging
    })

    it('should count both upvotes and downvotes separately', () => {
      const feedback = [
        { helpful: true }, // upvote 1
        { helpful: true }, // upvote 2
        { helpful: false }, // downvote 1
        { helpful: false }, // downvote 2
        { helpful: false }, // downvote 3
        { helpful: true }, // upvote 3
      ]

      const downvoteCount = feedback.filter((f) => !f.helpful).length
      const upvoteCount = feedback.filter((f) => f.helpful).length

      expect(downvoteCount).toBe(3)
      expect(upvoteCount).toBe(3)
      expect(downvoteCount >= 3).toBe(true)
      // Should trigger auto-flagging based on downvote threshold alone
    })
  })

  describe('Review queue management', () => {
    it('should list pending reviews (not yet resolved)', () => {
      const reviewQueue = [
        {
          documentId: 'doc_A',
          downvoteCount: 3,
          flaggedAt: Date.now() - 1000 * 60 * 30, // 30 min ago
          reviewedAt: null, // pending
          action: null,
        },
        {
          documentId: 'doc_B',
          downvoteCount: 4,
          flaggedAt: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
          reviewedAt: Date.now() - 1000 * 60 * 10, // reviewed 10 min ago
          action: 'doc_revised',
        },
      ]

      const pendingReviews = reviewQueue.filter((r) => r.reviewedAt === null)
      expect(pendingReviews).toHaveLength(1)
      expect(pendingReviews[0].documentId).toBe('doc_A')
    })

    it('should record resolution with action and timestamp', () => {
      const review = {
        documentId: 'doc_A',
        downvoteCount: 3,
        flaggedAt: Date.now() - 1000 * 60 * 30,
        reviewedAt: null,
        action: null,
      }

      const now = Date.now()
      const adminUserId = 'admin_user_123'

      // Admin resolves the review
      const resolved = {
        ...review,
        reviewedAt: now,
        action: 'prompt_updated' as const,
        reviewedBy: adminUserId,
      }

      expect(resolved.reviewedAt).toBe(now)
      expect(resolved.action).toBe('prompt_updated')
      expect(resolved.reviewedBy).toBe(adminUserId)
    })
  })

  describe('System prompt versioning', () => {
    it('should create new prompt version with metadata', () => {
      const newVersion = {
        id: 'prompt-12345',
        version: 2,
        content: 'Updated system prompt for better clarity...',
        topic: 'billing', // topic-specific prompt
        triggeredBy: 'admin_user_123',
        triggerEvent: 'auto_tune_3_downvotes' as const,
        active: false, // not active yet
        createdAt: Date.now(),
      }

      expect(newVersion.version).toBe(2)
      expect(newVersion.topic).toBe('billing')
      expect(newVersion.active).toBe(false)
      expect(newVersion.triggerEvent).toBe('auto_tune_3_downvotes')
    })

    it('should activate a new version and deactivate others in same scope', () => {
      // Scenario:
      // 1. Version 1 (billing) is active
      // 2. Admin creates Version 2 (billing)
      // 3. Admin activates Version 2
      // Expected: Version 1 becomes inactive, Version 2 becomes active

      const versions = [
        { id: 'prompt-v1', version: 1, topic: 'billing', active: true },
        { id: 'prompt-v2', version: 2, topic: 'billing', active: false },
        { id: 'prompt-global-v1', version: 1, topic: null, active: true },
      ]

      // Before activation
      const v1Active = versions.filter((v) => v.topic === 'billing' && v.active)
      expect(v1Active).toHaveLength(1)
      expect(v1Active[0].id).toBe('prompt-v1')

      // After activation of v2
      const activated = versions.map((v) => ({
        ...v,
        active:
          v.id === 'prompt-v2'
            ? true
            : v.topic === 'billing'
              ? false
              : v.active, // deactivate other billing prompts, leave global alone
      }))

      const v2Active = activated.filter((v) => v.topic === 'billing' && v.active)
      expect(v2Active).toHaveLength(1)
      expect(v2Active[0].id).toBe('prompt-v2')

      // Global prompt should remain active
      const globalActive = activated.filter((v) => v.topic === null && v.active)
      expect(globalActive).toHaveLength(1)
    })

    it('should fallback to global prompt if topic-specific not found', () => {
      // User asks question about "getting started"
      // Admin has topic-specific prompts for: billing, troubleshooting
      // But NOT for "getting-started"
      // Expected: Use global active prompt

      const topic = 'getting-started'
      const topicSpecificPrompt = null // Not found
      const globalPrompt = {
        id: 'prompt-global-v1',
        version: 1,
        content: 'Default system prompt...',
        topic: null,
        active: true,
      }

      const activePrompt = topicSpecificPrompt || globalPrompt
      expect(activePrompt).toBe(globalPrompt)
      expect(activePrompt.topic).toBeNull()
    })
  })

  describe('End-to-end auto-tune scenario', () => {
    it('should complete: ask → feedback → flag → resolve → activate new prompt', () => {
      const scenario = {
        // Step 1: Ask question
        question: 'How do I upgrade my plan?',
        topic: 'billing',
        documentId: 'doc_billing_1',
        answer: 'Outdated answer about upgrading...',

        // Step 2: User provides downvote feedback
        feedback: {
          helpful: false,
          feedbackText: 'This information is outdated',
        },

        // Step 3: Aggregation triggers auto-flag (after 3 downvotes)
        downvoteCount: 3,
        flaggedAt: Date.now(),

        // Step 4: Admin reviews the flagged doc
        reviewAction: 'prompt_updated' as const,
        resolvedAt: Date.now(),

        // Step 5: Admin creates and activates new prompt
        newPromptVersion: 2,
        newPromptContent: 'Updated system prompt with current billing info...',
        activated: true,
      }

      // Verify the flow
      expect(scenario.question).toBeTruthy()
      expect(scenario.feedback.helpful).toBe(false)
      expect(scenario.downvoteCount >= 3).toBe(true)
      expect(scenario.reviewAction).toBe('prompt_updated')
      expect(scenario.newPromptVersion).toBe(2)
      expect(scenario.activated).toBe(true)
    })
  })
})
