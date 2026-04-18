import type Anthropic from '@anthropic-ai/sdk';
import ora from 'ora';
import { client } from '../client';
import { MODEL, MAX_TOKENS, MAX_HISTORY_TURNS } from '../config';
import { systemPrompt } from '../prompts/system';
import { toolDefinitions, toolMap } from '../tools';

type MessageParam = Anthropic.Messages.MessageParam;
type ToolUseBlock = Anthropic.Messages.ToolUseBlock;
type ToolResultBlockParam = Anthropic.Messages.ToolResultBlockParam;

const THINKING_WORDS = [
  'Noodling',
  'Galaxy-braining',
  'Marinating',
  'Percolating',
  'Hmmmming',
  'Synapse-smooshing',
  'Overthinking',
  'Consulting the oracle',
  'Brewing thoughts',
  'Summoning neurons',
];

const pickThinkingWord = () =>
  THINKING_WORDS[Math.floor(Math.random() * THINKING_WORDS.length)];

// Trims old messages to cap context. Safe cut points are plain-text user
// messages (not tool_result batches), so we never split a tool_use/tool_result
// pair — the API rejects orphaned tool_use blocks.
function trimHistory(
  messages: MessageParam[],
  cap: number,
): MessageParam[] {
  if (messages.length <= cap) return messages;
  const minDropIndex = messages.length - cap;
  for (let i = minDropIndex; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === 'user' && typeof m.content === 'string') {
      return messages.slice(i);
    }
  }
  return messages;
}

export async function runAgent(
  userMessage: string,
  history: MessageParam[] = [],
): Promise<{ reply: string; history: MessageParam[] }> {
  const messages: MessageParam[] = [
    ...history,
    { role: 'user', content: userMessage },
  ];

  while (true) {
    const spinner = ora({
      text: `\x1b[36m${pickThinkingWord()}...\x1b[0m`,
      color: 'cyan',
    }).start();
    let response;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        tools: toolDefinitions,
        messages,
      });
    } finally {
      spinner.stop();
    }

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') {
      const text = response.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('\n');
      const reply =
        response.stop_reason === 'max_tokens'
          ? `${text}\n\n_[Response truncated: max_tokens reached.]_`
          : text;
      return { reply, history: trimHistory(messages, MAX_HISTORY_TURNS) };
    }

    if (response.stop_reason !== 'tool_use') {
      throw new Error(`Unexpected stop_reason: ${response.stop_reason}`);
    }

    const toolUses = response.content.filter(
      (b): b is ToolUseBlock => b.type === 'tool_use',
    );

    const toolResults: ToolResultBlockParam[] = await Promise.all(
      toolUses.map(async block => {
        const tool = toolMap.get(block.name);
        if (!tool) {
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            content: `Error: unknown tool "${block.name}"`,
            is_error: true,
          };
        }
        try {
          const result = await tool.handler(
            block.input as Record<string, unknown>,
          );
          console.log(
            `\x1b[90m[Tool call] \x1b[1;38;5;250m${block.name}\x1b[0;90m ${result.display}\x1b[0m`,
          );
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            content: result.content,
          };
        } catch (err) {
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            content: `Error: ${(err as Error).message}`,
            is_error: true,
          };
        }
      }),
    );

    messages.push({ role: 'user', content: toolResults });
  }
}
