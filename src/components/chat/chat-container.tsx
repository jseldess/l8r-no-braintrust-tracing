'use client'

import * as React from 'react'
import { ChatMessage, Message, TypingIndicator } from './chat-message'
import { ChatInput } from './chat-input'
import { MessageCircle, Sparkles } from 'lucide-react'

interface ToolCall {
  id: string
  name: string
  arguments: string
  result?: unknown
}

const SUGGESTED_PROMPTS = [
  "What's my current balance?",
  'Show me my recent orders',
  'Do I have any failed payments?',
  'I want to request a refund',
]

export function ChatContainer() {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  React.useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async (content: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      // Build messages for API - include tool calls for full conversation history
      const apiMessages: Array<{
        role: string
        content: string
        tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
        tool_call_id?: string
      }> = []

      for (const m of [...messages, userMessage]) {
        if (m.toolCalls && m.toolCalls.length > 0) {
          // Assistant message with tool calls
          apiMessages.push({
            role: m.role,
            content: m.content || '',
            tool_calls: m.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.name, arguments: tc.arguments },
            })),
          })
          // Add tool result messages for each tool call
          for (const tc of m.toolCalls) {
            if (tc.result !== undefined) {
              apiMessages.push({
                role: 'tool',
                content: JSON.stringify(tc.result),
                tool_call_id: tc.id,
              })
            }
          }
        } else {
          // Regular message without tool calls
          apiMessages.push({
            role: m.role,
            content: m.content,
          })
        }
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
        }),
      })

      if (!response.ok) throw new Error('Failed to send message')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        toolCalls: [],
        isStreaming: true,
      }

      setMessages((prev) => [...prev, assistantMessage])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              assistantMessage = { ...assistantMessage, isStreaming: false }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessage.id ? assistantMessage : m
                )
              )
              continue
            }

            try {
              const parsed = JSON.parse(data)

              if (parsed.type === 'content') {
                assistantMessage = {
                  ...assistantMessage,
                  content: assistantMessage.content + parsed.content,
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id ? assistantMessage : m
                  )
                )
              }

              if (parsed.type === 'tool_calls') {
                const newToolCalls: ToolCall[] = parsed.tool_calls.map(
                  (tc: { id: string; name: string; arguments: string }) => ({
                    id: tc.id,
                    name: tc.name,
                    arguments: tc.arguments,
                  })
                )
                assistantMessage = {
                  ...assistantMessage,
                  toolCalls: [...(assistantMessage.toolCalls || []), ...newToolCalls],
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id ? assistantMessage : m
                  )
                )
              }

              if (parsed.type === 'tool_result') {
                assistantMessage = {
                  ...assistantMessage,
                  toolCalls: assistantMessage.toolCalls?.map((tc) =>
                    tc.id === parsed.tool_call_id
                      ? { ...tc, result: parsed.result }
                      : tc
                  ),
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id ? assistantMessage : m
                  )
                )
              }
            } catch {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: "I'm sorry, I encountered an error. Please try again.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] lg:h-[calc(100vh-10rem)]">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 mb-4">
              <MessageCircle className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">l8r Support</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              I can help you check your balance, view orders, manage payment plans,
              retry failed payments, and more.
            </p>

            {/* Suggested Prompts */}
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-muted hover:bg-muted/80 text-sm transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <TypingIndicator />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card/50 p-4">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            onSend={sendMessage}
            disabled={isLoading}
            placeholder="Ask about your orders, payments, or account..."
          />
        </div>
      </div>
    </div>
  )
}
