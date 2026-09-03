import { ChatCompletionMessageFunctionToolCall } from 'openai/resources/chat/completions'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: ChatCompletionMessageFunctionToolCall[]
  tool_call_id?: string
}
