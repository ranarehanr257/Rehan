import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai'
import { perplexity } from '@ai-sdk/perplexity'
import { JARVIS_SYSTEM_PROMPT } from '@/lib/jarvis-prompt'

// Allow streaming responses up to 30 seconds
export const maxDuration = 30

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const result = streamText({
    // Perplexity Sonar performs live web search and returns grounding sources.
    // Uses the PERPLEXITY_API_KEY environment variable directly.
    model: perplexity('sonar-pro'),
    instructions: JARVIS_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      sendSources: true,
    }),
  })
}
