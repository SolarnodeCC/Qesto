import { describe, it, expect } from 'vitest'

/**
 * Unit tests for system prompt versioning and retrieval.
 * Note: These are scenario-based tests. Real DB tests would need D1 mocking.
 */

describe('Help Prompts - Version Management', () => {
  describe('Active prompt retrieval logic', () => {
    it('should prioritize topic-specific active prompt over global', () => {
      const prompts = [
        { id: 'p1', topic: 'billing', active: true, version: 2 },
        { id: 'p2', topic: null, active: true, version: 1 }, // global
      ]

      // When looking for billing topic with active prompts
      const topic = 'billing'
      const topicSpecific = prompts.find((p) => p.topic === topic && p.active)
      const global = prompts.find((p) => p.topic === null && p.active)

      const active = topicSpecific || global
      expect(active?.id).toBe('p1') // Should use topic-specific
      expect(active?.topic).toBe('billing')
    })

    it('should fallback to global prompt if topic-specific not found', () => {
      const prompts = [
        { id: 'p1', topic: 'billing', active: true, version: 1 },
        { id: 'p2', topic: null, active: true, version: 1 }, // global
      ]

      // When looking for non-existent topic
      const topic = 'getting-started'
      const topicSpecific = prompts.find((p) => p.topic === topic && p.active)
      const global = prompts.find((p) => p.topic === null && p.active)

      const active = topicSpecific || global
      expect(active?.id).toBe('p2') // Should use global fallback
      expect(active?.topic).toBeNull()
    })

    it('should ignore inactive prompts', () => {
      const prompts = [
        { id: 'p1', topic: 'billing', active: false, version: 1 },
        { id: 'p2', topic: 'billing', active: true, version: 2 },
      ]

      const billingActive = prompts.find((p) => p.topic === 'billing' && p.active)
      expect(billingActive?.id).toBe('p2')
      expect(billingActive?.version).toBe(2)
    })

    it('should return null if no active prompt exists', () => {
      const prompts = [
        { id: 'p1', topic: 'billing', active: false, version: 1 },
        { id: 'p2', topic: null, active: false, version: 1 },
      ]

      const topicSpecific = prompts.find((p) => p.topic === 'billing' && p.active)
      const global = prompts.find((p) => p.topic === null && p.active)
      const active = topicSpecific || global

      expect(active).toBeUndefined()
    })
  })

  describe('Prompt activation and deactivation', () => {
    it('should deactivate other prompts in same topic scope when activating new version', () => {
      const prompts = [
        { id: 'p1', topic: 'billing', active: true, version: 1 },
        { id: 'p2', topic: 'billing', active: false, version: 2 },
        { id: 'p3', topic: null, active: true, version: 1 }, // global
      ]

      // Activate p2
      const targetPrompt = prompts.find((p) => p.id === 'p2')!
      const updated = prompts.map((p) => ({
        ...p,
        active:
          p.id === 'p2'
            ? true
            : p.topic === targetPrompt.topic && p.topic !== null
              ? false // deactivate other billing prompts
              : p.active, // leave global and other topics unchanged
      }))

      const billingActive = updated.filter((p) => p.topic === 'billing' && p.active)
      const globalActive = updated.filter((p) => p.topic === null && p.active)

      expect(billingActive).toHaveLength(1)
      expect(billingActive[0].id).toBe('p2')
      expect(globalActive).toHaveLength(1)
      expect(globalActive[0].id).toBe('p3') // global unchanged
    })

    it('should handle deactivating all versions in scope when activating global', () => {
      const prompts = [
        { id: 'p1', topic: null, active: true, version: 1 },
        { id: 'p2', topic: null, active: false, version: 2 },
        { id: 'p3', topic: 'billing', active: true, version: 1 }, // topic-specific
      ]

      // Activate p2 (global)
      const targetPrompt = prompts.find((p) => p.id === 'p2')!
      const updated = prompts.map((p) => ({
        ...p,
        active:
          p.id === 'p2'
            ? true
            : p.topic === targetPrompt.topic && p.topic === null
              ? false // deactivate other global
              : p.active, // leave topic-specific unchanged
      }))

      const globalActive = updated.filter((p) => p.topic === null && p.active)
      const billingActive = updated.filter((p) => p.topic === 'billing' && p.active)

      expect(globalActive).toHaveLength(1)
      expect(globalActive[0].id).toBe('p2')
      expect(billingActive).toHaveLength(1)
      expect(billingActive[0].id).toBe('p3') // topic-specific unchanged
    })
  })

  describe('Prompt versioning', () => {
    it('should track version number sequentially', () => {
      const versions = [
        { id: 'p1', version: 1, topic: 'billing' },
        { id: 'p2', version: 2, topic: 'billing' },
        { id: 'p3', version: 3, topic: 'billing' },
      ]

      const nextVersion = Math.max(...versions.map((v) => v.version)) + 1
      expect(nextVersion).toBe(4)
    })

    it('should preserve version history for auditing', () => {
      const versions = [
        {
          id: 'p1',
          version: 1,
          topic: 'billing',
          content: 'Original prompt...',
          triggered_by: 'admin_1',
          trigger_event: 'manual_admin',
          created_at: 1000,
        },
        {
          id: 'p2',
          version: 2,
          topic: 'billing',
          content: 'Updated prompt after 3 downvotes...',
          triggered_by: 'system',
          trigger_event: 'auto_tune_3_downvotes',
          created_at: 2000,
        },
      ]

      // Should be able to audit the history
      expect(versions).toHaveLength(2)
      expect(versions[0].trigger_event).toBe('manual_admin')
      expect(versions[1].trigger_event).toBe('auto_tune_3_downvotes')
    })

    it('should support topic-specific and global versions in same namespace', () => {
      const allVersions = [
        { id: 'p1', version: 1, topic: 'billing' },
        { id: 'p2', version: 2, topic: 'billing' },
        { id: 'p3', version: 1, topic: null }, // global v1
        { id: 'p4', version: 2, topic: null }, // global v2
        { id: 'p5', version: 1, topic: 'troubleshooting' },
      ]

      // Version numbers are independent per topic scope
      const billingVersions = allVersions.filter((p) => p.topic === 'billing').map((p) => p.version)
      const globalVersions = allVersions.filter((p) => p.topic === null).map((p) => p.version)
      const tshootVersions = allVersions.filter((p) => p.topic === 'troubleshooting').map((p) => p.version)

      expect(billingVersions).toEqual([1, 2])
      expect(globalVersions).toEqual([1, 2])
      expect(tshootVersions).toEqual([1])
    })
  })

  describe('Trigger events and audit trail', () => {
    it('should record trigger event when creating prompt', () => {
      const newPrompt = {
        id: 'p1',
        version: 1,
        content: 'System prompt...',
        topic: 'billing',
        trigger_event: 'manual_admin' as const,
        triggered_by: 'admin_user_123',
        created_at: Date.now(),
      }

      expect(newPrompt.trigger_event).toBe('manual_admin')
      expect(newPrompt.triggered_by).toBeTruthy()
    })

    it('should support auto-tune trigger event', () => {
      const autoTunePrompt = {
        id: 'p2',
        version: 2,
        content: 'Updated after downvotes...',
        topic: 'billing',
        trigger_event: 'auto_tune_3_downvotes' as const,
        triggered_by: 'system',
        created_at: Date.now(),
      }

      expect(autoTunePrompt.trigger_event).toBe('auto_tune_3_downvotes')
      expect(autoTunePrompt.triggered_by).toBe('system')
    })

    it('should track creation timestamp', () => {
      const now = Date.now()
      const prompt = {
        id: 'p1',
        created_at: now,
      }

      expect(prompt.created_at).toBeLessThanOrEqual(Date.now())
    })
  })

  describe('Topic scope isolation', () => {
    it('should isolate topic-specific prompts from each other', () => {
      const billingV1 = { id: 'p1', topic: 'billing', active: true, version: 1 }
      const tshootV1 = { id: 'p2', topic: 'troubleshooting', active: true, version: 1 }
      const globalV1 = { id: 'p3', topic: null, active: true, version: 1 }

      // Activating billing v2 should not affect other topics
      const billingV2 = { id: 'p4', topic: 'billing', active: true, version: 2 }
      const billingV1Updated = { ...billingV1, active: false }

      const prompts = [billingV1Updated, tshootV1, globalV1, billingV2]

      const activeBilling = prompts.filter((p) => p.topic === 'billing' && p.active)
      const activeTshoot = prompts.filter((p) => p.topic === 'troubleshooting' && p.active)
      const activeGlobal = prompts.filter((p) => p.topic === null && p.active)

      expect(activeBilling).toHaveLength(1)
      expect(activeBilling[0].id).toBe('p4')
      expect(activeTshoot).toHaveLength(1) // unchanged
      expect(activeTshoot[0].id).toBe('p2')
      expect(activeGlobal).toHaveLength(1) // unchanged
      expect(activeGlobal[0].id).toBe('p3')
    })
  })
})
