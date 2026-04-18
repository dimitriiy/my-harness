import type Anthropic from '@anthropic-ai/sdk';
import { runAgent } from './agent/loop';
import { renderMarkdown } from './render';
import { readLineHighlighted } from './input';

const EXIT_CMD = '/exit';

async function main() {
  let history: Anthropic.Messages.MessageParam[] = [];

  console.log(`Chat started. Type "${EXIT_CMD}" to quit.\n`);

  while (true) {
    const userPrompt = (await readLineHighlighted()).trim();

    if (!userPrompt) continue;
    if (userPrompt === EXIT_CMD) break;

    const { reply, history: next } = await runAgent(userPrompt, history);
    history = next;
    console.log(`\n${renderMarkdown(reply)}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
