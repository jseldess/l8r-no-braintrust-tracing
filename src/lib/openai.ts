import OpenAI from 'openai'

// Model calls are routed through the Braintrust AI gateway, so provider credentials
// live in Braintrust settings rather than in a local OPENAI_API_KEY. This is the
// gateway only — no tracing or logging is attached to these calls.
//
// Constructed lazily: the OpenAI SDK throws if no key is present, and this module is
// loaded at build time (page-data collection), when the env may not be set.
let client: OpenAI | null = null

export function getOpenAI(): OpenAI {
  if (!client) {
    client = new OpenAI({
      baseURL: 'https://gateway.braintrust.dev',
      apiKey: process.env.BRAINTRUST_API_KEY,
    })
  }
  return client
}
