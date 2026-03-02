import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { notify, openOrFocusBrowser } from './notify.js'
import { store } from './store.js'
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

export async function startMcp(serverUrl: string): Promise<void> {
  const server = new McpServer({
    name: 'ask-user-questions',
    version: '0.1.0'
  })

  server.tool(
    'ask_user',
    'Ask the user questions and wait for their response. Use this when you need clarification, user preferences, or further instructions. Batch related questions into a single call (max 4). An "Other" option is always available for custom input—do not add your own.',
    {
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
    },
    async ({ questions }) => {
      // Normalize sub-questions
      const subQuestions: SubQuestion[] = questions.map((q) => ({
        question: q.question,
        multiSelect: q.multiSelect ?? false,
        options: q.options
      }))

      // Create question group in store
      const q = store.createQuestion(subQuestions)

      // Notify the user
      const firstQ = subQuestions[0].question
      const preview = firstQ.slice(0, 80) + (firstQ.length > 80 ? '...' : '')
      const badge = subQuestions.length > 1 ? ` (+${subQuestions.length - 1} more)` : ''
      notify(`AI asks: ${preview}${badge}`)
      openOrFocusBrowser(serverUrl)

      console.error(
        `[ask-user-questions] Question group created: ${q.id} (${subQuestions.length} questions)`
      )
      console.error(`[ask-user-questions] Waiting for user answers...`)

      // Block until the user answers (or timeout)
      const answers = await store.waitForAnswer(q.id)

      console.error(`[ask-user-questions] Answers received for: ${q.id}`)

      return {
        content: [{ type: 'text' as const, text: formatAnswers(subQuestions, answers) }]
      }
    }
  )

  const transport = new StdioServerTransport()
  await server.connect(transport)
}
