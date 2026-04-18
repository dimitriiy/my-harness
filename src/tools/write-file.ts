import fs from 'node:fs/promises';
import path from 'node:path';
import { MAX_WRITE_BYTES } from '../config';
import type { Tool } from '../types';
import { safeResolve } from './safe-path';

export const writeFile: Tool = {
  definition: {
    name: 'write_file',
    description:
      'Write UTF-8 content to a file at a path relative to the working directory. Overwrites if the file exists and creates missing parent directories. Paths that escape the working directory, or content exceeding the size cap, are rejected. Returns JSON: { ok, path, bytes }.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the file' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
  },
  handler: async ({ path: p, content }) => {
    const full = safeResolve(p as string);
    const text = content as string;
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes > MAX_WRITE_BYTES) {
      throw new Error(
        `Content too large: ${bytes} bytes (limit ${MAX_WRITE_BYTES}).`,
      );
    }
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, text, 'utf8');
    return {
      content: JSON.stringify({ ok: true, path: p, bytes }, null, 2),
      display: `${p} (${bytes} bytes)`,
    };
  },
};
