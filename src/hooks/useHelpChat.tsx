import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import { api } from '../api/client'

export type HelpMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  sources?: Array<{ documentId: string; title: string; relevance: number }>
}

export type HelpChatState = {
  isOpen: boolean
  isLoading: boolean
  error: string | null
  messages: HelpMessage[]
  sessionId: string | null
}

type Action =
  | { kind: 'toggle' }
  | { kind: 'open' }
  | { kind: 'close' }
  | { kind: 'ask_start'; question: string }
  | { kind: 'ask_success'; answer: string; sources: Array<{ documentId: string; title: string; relevance: number }> }
  | { kind: 'ask_error'; error: string }
  | { kind: 'feedback_sent' }
  | { kind: 'clear_error' }
  | { kind: 'clear_history' }

export const INITIAL_HELP_STATE: HelpChatState = {
  isOpen: false,
  isLoading: false,
  error: null,
  messages: [],
  sessionId: null,
}

export function helpChatReducer(state: HelpChatState, action: Action): HelpChatState {
  switch (action.kind) {
    case 'toggle':
      return { ...state, isOpen: !state.isOpen, error: null }
    case 'open':
      return { ...state, isOpen: true, error: null }
    case 'close':
      return { ...state, isOpen: false }
    case 'ask_start':
      return {
        ...state,
        isLoading: true,
        error: null,
        messages: [
          ...state.messages,
          {
            id: `user-${Date.now()}`,
            role: 'user',
            content: action.question,
            timestamp: Date.now(),
          },
        ],
      }
    case 'ask_success':
      return {
        ...state,
        isLoading: false,
        messages: [
          ...state.messages,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: action.answer,
            timestamp: Date.now(),
            sources: action.sources,
          },
        ],
      }
    case 'ask_error':
      return { ...state, isLoading: false, error: action.error }
    case 'feedback_sent':
      return { ...state }
    case 'clear_error':
      return { ...state, error: null }
    case 'clear_history':
      return { ...state, messages: [] }
  }
}

export type HelpChatApi = {
  state: HelpChatState
  askQuestion: (question: string) => Promise<void>
  submitFeedback: (documentId: string, helpful: boolean, feedbackText?: string) => Promise<void>
  toggleChat: () => void
  closeChat: () => void
  openChat: () => void
  clearError: () => void
  clearHistory: () => void
  cancel: () => void
}

const HelpChatContext = createContext<HelpChatApi | null>(null)

export function HelpChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(helpChatReducer, INITIAL_HELP_STATE)
  const abortControllerRef = useRef<AbortController | null>(null)

  const askQuestion = useCallback(async (question: string) => {
    if (!question.trim()) return

    dispatch({ kind: 'ask_start', question })
    abortControllerRef.current = new AbortController()

    try {
      const result = await api<{ answer: string; sources: Array<{ documentId: string; title: string; relevance: number }> }>(
        '/api/help/ask',
        {
          method: 'POST',
          body: { question },
          signal: abortControllerRef.current.signal,
        },
      )

      if (!result.ok) {
        dispatch({
          kind: 'ask_error',
          error: result.error.message || 'Failed to get answer',
        })
        return
      }

      dispatch({
        kind: 'ask_success',
        answer: result.data.answer,
        sources: result.data.sources,
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      dispatch({
        kind: 'ask_error',
        error: err instanceof Error ? err.message : 'Unknown error occurred',
      })
    }
  }, [])

  const submitFeedback = useCallback(
    async (documentId: string, helpful: boolean, feedbackText?: string) => {
      try {
        const result = await api<{ feedback_id: string }>('/api/help/feedback', {
          method: 'POST',
          body: {
            documentId,
            helpful,
            feedbackText,
          },
        })

        if (!result.ok) {
          console.error('Feedback submission failed:', result.error)
          return
        }

        dispatch({ kind: 'feedback_sent' })
      } catch (err) {
        console.error('Error submitting feedback:', err)
      }
    },
    [],
  )

  const toggleChat = useCallback(() => {
    dispatch({ kind: 'toggle' })
  }, [])

  const closeChat = useCallback(() => {
    dispatch({ kind: 'close' })
  }, [])

  const openChat = useCallback(() => {
    dispatch({ kind: 'open' })
  }, [])

  const clearError = useCallback(() => {
    dispatch({ kind: 'clear_error' })
  }, [])

  const clearHistory = useCallback(() => {
    dispatch({ kind: 'clear_history' })
  }, [])

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort()
    dispatch({ kind: 'ask_error', error: 'Request cancelled' })
  }, [])

  const value = useMemo<HelpChatApi>(
    () => ({
      state,
      askQuestion,
      submitFeedback,
      toggleChat,
      closeChat,
      openChat,
      clearError,
      clearHistory,
      cancel,
    }),
    [state, askQuestion, submitFeedback, toggleChat, closeChat, openChat, clearError, clearHistory, cancel],
  )

  return <HelpChatContext.Provider value={value}>{children}</HelpChatContext.Provider>
}

export function useHelpChat(): HelpChatApi {
  const ctx = useContext(HelpChatContext)
  if (!ctx) throw new Error('useHelpChat must be used inside <HelpChatProvider>')
  return ctx
}
