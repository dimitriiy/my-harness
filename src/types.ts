import type Anthropic from '@anthropic-ai/sdk';

export type ToolDefinition = Anthropic.Messages.Tool;

export interface ToolResult {
  content: string; // sent back to the model as tool_result
  display: string; // one-line human summary printed to the terminal
}

export interface Tool {
  definition: ToolDefinition;
  handler: (
    input: Record<string, unknown>,
  ) => Promise<ToolResult> | ToolResult;
}
