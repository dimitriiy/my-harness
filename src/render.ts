import md from 'cli-markdown';

export function renderMarkdown(text: string): string {
  return md(text).trimEnd();
}
