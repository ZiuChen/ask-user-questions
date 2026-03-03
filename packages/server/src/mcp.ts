import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { getConfig } from './config.js'
import { notify, openOrFocusBrowser } from './notify.js'
import type { SubQuestion, SubQuestionAnswer } from './types.js'

function formatAnswers(questions: SubQuestion[], answers: SubQuestionAnswer[]): string {
  // Single question, single selected, no freeText → just the label
  if (questions.length === 1) {
    const a = answers[0]
    if (a.selected.length > 0 && !a.freeText) {
      return a.selected.length === 1 ? a.selected[0] : a.selected.join(', ')
    }
    if (a.freeText && a.selected.length === 0) {
      return a.freeText
    }
  }

  // Multiple questions or mixed answers → structured JSON
  return JSON.stringify(
    questions.map((q, i) => ({
      question: q.question,
      selected: answers[i].selected,
      freeText: answers[i].freeText || null
    })),
    null,
    2
  )
}

/** Create a question and wait for answer via the HTTP server */
async function remoteAskUser(
  serverUrl: string,
  subQuestions: SubQuestion[]
): Promise<{ id: string; answers: SubQuestionAnswer[] }> {
  const createRes = await fetch(`${serverUrl}/api/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions: subQuestions })
  })
  if (!createRes.ok) {
    throw new Error(`Failed to create question: ${createRes.status} ${await createRes.text()}`)
  }
  const question = (await createRes.json()) as { id: string }

  // Long-poll with retry — the connection may drop due to network issues,
  // proxy timeouts, or other transient errors. Retry until we get an answer.
  while (true) {
    try {
      const waitRes = await fetch(`${serverUrl}/api/questions/${question.id}/wait`)
      if (!waitRes.ok) {
        throw new Error(`Failed to wait for answer: ${waitRes.status} ${await waitRes.text()}`)
      }
      const { answers } = (await waitRes.json()) as { answers: SubQuestionAnswer[] }
      return { id: question.id, answers }
    } catch (err) {
      // Check if the question was already answered (e.g. connection dropped after answer)
      try {
        const checkRes = await fetch(`${serverUrl}/api/questions/${question.id}`)
        if (checkRes.ok) {
          const q = (await checkRes.json()) as { status: string; answers?: SubQuestionAnswer[] }
          if (q.status !== 'pending' && q.answers) {
            return { id: question.id, answers: q.answers }
          }
        }
      } catch {
        // Server might be temporarily unreachable
      }
      console.error(
        `[ask-user-questions] Long-poll interrupted, retrying in 1s...`,
        (err as Error).message
      )
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
}

/** Check if there are browser clients connected to the server */
async function hasBrowserClients(serverUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${serverUrl}/api/health`, {
      signal: AbortSignal.timeout(2000)
    })
    if (!res.ok) return false
    const data = (await res.json()) as { browserClients?: number }
    return (data.browserClients ?? 0) > 0
  } catch {
    return false
  }
}

export async function startMcp(serverUrl: string): Promise<void> {
  const server = new McpServer({
    name: 'ask-user-questions',
    version: '0.1.0'
  })

  server.registerTool(
    'ask_user',
    {
      title: 'Ask user questions',
      description:
        'Ask the user questions and wait for their response. Use this when you need clarification, user preferences, or further instructions. Batch related questions into a single call (max 4). An "Other" option is always available for custom input—do not add your own.',
      inputSchema: z.object({
        questions: z
          .array(
            z.object({
              question: z.string().describe('The complete question text to display'),
              multiSelect: z
                .boolean()
                .optional()
                .default(false)
                .describe('Allow multiple selections'),
              options: z
                .array(
                  z.object({
                    label: z.string().describe('Option label text'),
                    description: z
                      .string()
                      .optional()
                      .describe('Optional description for the option'),
                    recommended: z.boolean().optional().describe('Mark this option as recommended')
                  })
                )
                .optional()
                .describe(
                  'Options for the user to choose from. If omitted, shows only a free-text input.'
                )
            })
          )
          .min(1)
          .max(4)
          .describe('Array of 1-4 questions to ask the user')
      })
    },
    async ({ questions }) => {
      const subQuestions: SubQuestion[] = questions.map((q) => ({
        question: q.question,
        multiSelect: q.multiSelect ?? false,
        options: q.options
      }))

      // Notify the user — clicking the notification opens/focuses the browser
      const config = getConfig()
      const firstQ = subQuestions[0].question
      const preview = firstQ.slice(0, 80) + (firstQ.length > 80 ? '...' : '')
      const badge = subQuestions.length > 1 ? ` (+${subQuestions.length - 1} more)` : ''
      if (config.notification) {
        notify(`AI asks: ${preview}${badge}`, 'Ask User Questions', () => {
          openOrFocusBrowser(serverUrl)
        })
      }

      // Only open browser if no browser client is currently connected
      if (config.autoOpenBrowser) {
        const hasClients = await hasBrowserClients(serverUrl)
        if (!hasClients) {
          openOrFocusBrowser(serverUrl)
        }
      }

      // Always proxy through the daemon HTTP server
      console.error(`[ask-user-questions] Creating question (${subQuestions.length} sub-questions)`)
      console.error(`[ask-user-questions] Waiting for user answers...`)
      const result = await remoteAskUser(serverUrl, subQuestions)
      console.error(`[ask-user-questions] Answers received for: ${result.id}`)

      return {
        content: [{ type: 'text' as const, text: formatAnswers(subQuestions, result.answers) }]
      }
    }
  )

  const transport = new StdioServerTransport()
  await server.connect(transport)
}
