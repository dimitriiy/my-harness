import fs from 'node:fs/promises';
import type { Tool } from '../types';
import { safeResolve } from './safe-path';

export const readFile: Tool = {
  definition: {
    name: 'read_file',
    description:
      'Read the contents of a text file at a path relative to the working directory. Returns the raw file contents as a UTF-8 string. Absolute paths and paths that escape the working directory are rejected.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the file' },
      },
      required: ['path'],
    },
  },
  handler: async ({ path: p }) => {
    const rel = p as string;
    const full = safeResolve(rel);
    const content = await fs.readFile(full, 'utf8');
    const lines = content.split('\n').length;
    const bytes = Buffer.byteLength(content, 'utf8');
    return {
      content,
      display: `${rel} (${bytes} bytes, ${lines} lines)`,
    };
  },
};
