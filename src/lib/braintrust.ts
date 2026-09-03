import { initLogger, wrapOpenAI, wrapTraced, updateSpan } from 'braintrust'
import OpenAI from 'openai'

// Initialize Braintrust logger
export const logger = initLogger({
  projectName: 'l8r-customer-service',
  apiKey: process.env.BRAINTRUST_API_KEY,
})

// Create OpenAI client wrapped with Braintrust tracing.
// Routed through the Braintrust AI gateway, so provider credentials live in
// Braintrust settings rather than in a local OPENAI_API_KEY.
const openaiClient = new OpenAI({
  baseURL: 'https://gateway.braintrust.dev',
  apiKey: process.env.BRAINTRUST_API_KEY,
})

export const openai = wrapOpenAI(openaiClient)

// Helper to create traced functions with custom type
export function wrapTracedTool<Args extends unknown[], Return>(
  fn: (...args: Args) => Promise<Return>
): (...args: Args) => Promise<Return> {
  return wrapTraced(fn, {
    type: 'tool' as const,
  })
}

// Helper to create traced functions
export { wrapTraced }

// Export updateSpan for updating existing spans
export { updateSpan }
