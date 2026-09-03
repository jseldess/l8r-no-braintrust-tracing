import { NextRequest } from 'next/server'
import { openai, logger, updateSpan } from '@/lib/braintrust'
import { chatbotTools, executeTool, systemPrompt, ToolName, ChatMessage } from '@/lib/chatbot'
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

export const runtime = 'nodejs'
export const maxDuration = 60

interface ChatRequestBody {
  messages: ChatMessage[]
  sessionId?: string
  parentSpanId?: string
}

interface ToolCallAccumulator {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export async function POST(request: NextRequest) {
  try {
    const { messages, sessionId, parentSpanId } = (await request.json()) as ChatRequestBody

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const turnNumber = messages.filter((m) => m.role === 'user').length
    const isFirstTurn = !parentSpanId

    // Span management for multi-turn conversations
    let conversationSpan: ReturnType<typeof logger.startSpan> | null = null
    let conversationSpanId: string

    if (isFirstTurn) {
      conversationSpan = logger.startSpan({ name: 'conversation' })
      conversationSpan.log({ metadata: { sessionId, type: 'multi_turn_conversation' } })
      conversationSpanId = await conversationSpan.export()
    } else {
      conversationSpanId = parentSpanId
    }

    return await logger.traced(
      async (turnSpan) => {
        turnSpan.log({
          input: messages[messages.length - 1]?.content,
          metadata: { sessionId, turnNumber },
        })

        // Build conversation messages
        const conversationMessages: ChatCompletionMessageParam[] = [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => {
            if (m.role === 'tool') {
              return { role: 'tool' as const, content: m.content, tool_call_id: m.tool_call_id! }
            }
            if (m.tool_calls) {
              return { role: 'assistant' as const, content: m.content || null, tool_calls: m.tool_calls }
            }
            return { role: m.role as 'user' | 'assistant', content: m.content }
          }),
        ]

        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          async start(controller) {
            // Send conversation span ID for distributed tracing
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'span_id', spanId: conversationSpanId })}\n\n`)
            )

            const currentMessages = [...conversationMessages]
            let continueLoop = true
            let finalContent = ''

            while (continueLoop) {
              const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: currentMessages,
                tools: chatbotTools,
                tool_choice: 'auto',
                stream: true,
                stream_options: { include_usage: true },
              })

              let assistantContent = ''
              const toolCalls: ToolCallAccumulator[] = []
              let currentToolCall: ToolCallAccumulator | null = null

              for await (const chunk of response) {
                const delta = chunk.choices[0]?.delta

                if (delta?.content) {
                  assistantContent += delta.content
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'content', content: delta.content })}\n\n`)
                  )
                }

                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    if (tc.index !== undefined) {
                      if (!toolCalls[tc.index]) {
                        toolCalls[tc.index] = { id: '', type: 'function', function: { name: '', arguments: '' } }
                      }
                      currentToolCall = toolCalls[tc.index]
                    }
                    if (currentToolCall) {
                      if (tc.id) currentToolCall.id = tc.id
                      if (tc.function?.name) currentToolCall.function.name = tc.function.name
                      if (tc.function?.arguments) currentToolCall.function.arguments += tc.function.arguments
                    }
                  }
                }
              }

              if (toolCalls.length > 0) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'tool_calls',
                      tool_calls: toolCalls.map((tc) => ({
                        id: tc.id,
                        name: tc.function.name,
                        arguments: tc.function.arguments,
                      })),
                    })}\n\n`
                  )
                )

                currentMessages.push({ role: 'assistant', content: assistantContent || null, tool_calls: toolCalls })

                for (const tc of toolCalls) {
                  const toolName = tc.function.name as ToolName
                  const parameters = JSON.parse(tc.function.arguments || '{}')

                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: 'tool_start', tool: toolName, tool_call_id: tc.id })}\n\n`
                    )
                  )

                  const { result, error } = await executeTool(toolName, parameters)
                  const toolResult = error ? { error } : result

                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: 'tool_result', tool: toolName, tool_call_id: tc.id, result: toolResult })}\n\n`
                    )
                  )

                  currentMessages.push({ role: 'tool', content: JSON.stringify(toolResult), tool_call_id: tc.id })
                }
              } else {
                continueLoop = false
                finalContent = assistantContent
                currentMessages.push({ role: 'assistant', content: assistantContent })

                // Update spans
                const fullHistory = currentMessages.slice(1, -1)
                turnSpan.log({ output: finalContent, metadata: { turnNumber } })

                if (conversationSpan) {
                  conversationSpan.log({
                    input: fullHistory,
                    output: finalContent,
                    metadata: { turnNumber, messagesCount: fullHistory.length },
                  })
                  conversationSpan.end()
                } else {
                  updateSpan({
                    exported: conversationSpanId,
                    input: fullHistory,
                    output: finalContent,
                    metadata: { turnNumber, messagesCount: fullHistory.length },
                  })
                }
              }
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          },
        })

        return new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
        })
      },
      { name: `chat_turn_${turnNumber}`, parent: conversationSpanId }
    )
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to process chat request',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
