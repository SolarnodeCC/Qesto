import { describe, it, expect } from 'vitest'
import { helpChatReducer, INITIAL_HELP_STATE } from '../../../src/hooks/useHelpChat'

describe('useHelpChat reducer', () => {
  it('toggles chat open/closed', () => {
    const state1 = helpChatReducer(INITIAL_HELP_STATE, { kind: 'toggle' })
    expect(state1.isOpen).toBe(true)

    const state2 = helpChatReducer(state1, { kind: 'toggle' })
    expect(state2.isOpen).toBe(false)
  })

  it('opens chat and clears error', () => {
    const errorState = { ...INITIAL_HELP_STATE, error: 'Some error' }
    const state = helpChatReducer(errorState, { kind: 'open' })
    expect(state.isOpen).toBe(true)
    expect(state.error).toBeNull()
  })

  it('closes chat', () => {
    const openState = { ...INITIAL_HELP_STATE, isOpen: true }
    const state = helpChatReducer(openState, { kind: 'close' })
    expect(state.isOpen).toBe(false)
  })

  it('adds user message and sets loading on ask_start', () => {
    const state = helpChatReducer(INITIAL_HELP_STATE, {
      kind: 'ask_start',
      question: 'How do I create a session?',
    })
    expect(state.isLoading).toBe(true)
    expect(state.error).toBeNull()
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].role).toBe('user')
    expect(state.messages[0].content).toBe('How do I create a session?')
  })

  it('adds assistant message and clears loading on ask_success', () => {
    const userMessageState = helpChatReducer(INITIAL_HELP_STATE, {
      kind: 'ask_start',
      question: 'How do I create a session?',
    })

    const state = helpChatReducer(userMessageState, {
      kind: 'ask_success',
      answer: 'To create a session, go to the dashboard and click "New Session".',
      sources: [
        {
          documentId: 'doc-1',
          title: 'Getting Started',
          relevance: 0.95,
        },
      ],
    })

    expect(state.isLoading).toBe(false)
    expect(state.messages).toHaveLength(2)
    expect(state.messages[1].role).toBe('assistant')
    expect(state.messages[1].content).toBe('To create a session, go to the dashboard and click "New Session".')
    expect(state.messages[1].sources).toHaveLength(1)
    expect(state.messages[1].sources?.[0].title).toBe('Getting Started')
  })

  it('sets error on ask_error', () => {
    const state = helpChatReducer(INITIAL_HELP_STATE, {
      kind: 'ask_error',
      error: 'Network error',
    })
    expect(state.isLoading).toBe(false)
    expect(state.error).toBe('Network error')
  })

  it('clears error on clear_error', () => {
    const errorState = { ...INITIAL_HELP_STATE, error: 'Some error' }
    const state = helpChatReducer(errorState, { kind: 'clear_error' })
    expect(state.error).toBeNull()
  })

  it('clears history on clear_history', () => {
    const stateWithMessages = {
      ...INITIAL_HELP_STATE,
      messages: [
        {
          id: '1',
          role: 'user' as const,
          content: 'Question',
          timestamp: Date.now(),
        },
        {
          id: '2',
          role: 'assistant' as const,
          content: 'Answer',
          timestamp: Date.now(),
        },
      ],
    }
    const state = helpChatReducer(stateWithMessages, { kind: 'clear_history' })
    expect(state.messages).toHaveLength(0)
  })
})
