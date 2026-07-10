import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useHelpChat } from '../hooks/useHelpChat'
import { inputHint } from '../ui/input-hint'

export function HelpChatWidget() {
  const { state, askQuestion, submitFeedback, toggleChat, closeChat } = useHelpChat()
  const [input, setInput] = useState('')
  const [feedbackStates, setFeedbackStates] = useState<Record<string, 'helpful' | 'not_helpful' | null>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const questionInputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.messages])

  useEffect(() => {
    if (state.isOpen) {
      questionInputRef.current?.focus()
    }
  }, [state.isOpen])

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || state.isLoading) return
    const question = input.trim()
    setInput('')
    await askQuestion(question)
  }

  const handleFeedback = async (messageId: string, helpful: boolean) => {
    const message = state.messages.find((m) => m.id === messageId)
    if (!message || message.role !== 'assistant' || !message.sources || message.sources.length === 0) return

    setFeedbackStates((prev) => ({
      ...prev,
      [messageId]: helpful ? 'helpful' : 'not_helpful',
    }))

    // Submit feedback for the first source document
    const firstSource = message.sources[0]
    await submitFeedback(firstSource.documentId, helpful)
  }

  const widget = (
    <div className="fixed bottom-8 right-8 z-50 font-sans">
      {/* Toggle button */}
      <button
        onClick={toggleChat}
        className="w-14 h-14 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg flex items-center justify-center transition-all duration-200"
        aria-label="Toggle help chat"
        aria-expanded={state.isOpen}
        title="Ask for help"
      >
        <svg
          className="w-8 h-8"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Chat window */}
      {state.isOpen && (
        <div className="absolute bottom-20 right-0 w-96 max-h-screen md:max-h-[600px] bg-white dark:bg-slate-900 rounded-lg shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-blue-500 text-white px-4 py-3 flex items-center justify-between">
            <h2 className="font-semibold text-sm">Qesto Help</h2>
            <button
              onClick={closeChat}
              className="text-white hover:text-blue-100 transition-colors"
              aria-label="Close help chat"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 dark:bg-slate-800">
            {state.messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center">
                <div className="text-gray-500 dark:text-gray-400 text-sm">
                  <p className="font-medium mb-2">Welcome! 👋</p>
                  <p>Ask a question about Qesto features, billing, or technical help.</p>
                </div>
              </div>
            ) : (
              <>
                {state.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs px-4 py-2 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 dark:bg-slate-700 dark:text-white text-gray-900'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                      {/* Sources */}
                      {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-opacity-30 dark:border-opacity-20">
                          <p className="text-xs font-medium opacity-75 mb-2">Sources:</p>
                          <ul className="space-y-1">
                            {message.sources.map((source, idx) => (
                              <li key={idx} className="text-xs opacity-75">
                                • {source.title}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Feedback buttons */}
                      {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-opacity-30 dark:border-opacity-20 flex gap-2">
                          <button
                            onClick={() => handleFeedback(message.id, true)}
                            className={`text-xs px-2 py-1 rounded transition-colors ${
                              feedbackStates[message.id] === 'helpful'
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-slate-500'
                            }`}
                            title="Mark as helpful"
                          >
                            👍
                          </button>
                          <button
                            onClick={() => handleFeedback(message.id, false)}
                            className={`text-xs px-2 py-1 rounded transition-colors ${
                              feedbackStates[message.id] === 'not_helpful'
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-slate-500'
                            }`}
                            title="Mark as not helpful"
                          >
                            👎
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {state.isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-200 dark:bg-slate-700 px-4 py-2 rounded-lg">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Error message */}
                {state.error && (
                  <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 px-4 py-2 rounded-lg text-sm">
                    {state.error}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input area */}
          <div className="border-t dark:border-slate-700 p-4 bg-white dark:bg-slate-800">
            <form onSubmit={handleAsk} className="flex gap-2">
              <input
                ref={questionInputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                {...inputHint("Ask a question...")}
                disabled={state.isLoading}
                className="flex-1 px-3 py-2 rounded-lg border dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                aria-label="Help question"
              />
              <button
                type="submit"
                disabled={state.isLoading || !input.trim()}
                className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
                aria-label="Send question"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )

  return createPortal(widget, document.body)
}
