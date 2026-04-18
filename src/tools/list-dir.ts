import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import type { Tool } from '../types';
import { safeResolve } from './safe-path';

function direntType(e: Dirent): string {
  switch (true) {
    case e.isDirectory():
      return 'dir';
    case e.isFile():
      return 'file';
    case e.isSymbolicLink():
      return 'symlink';
    case e.isBlockDevice():
      return 'block';
    case e.isCharacterDevice():
      return 'char';
    case e.isFIFO():
      return 'fifo';
    case e.isSocket():
      return 'socket';
    default:
      return 'unknown';
  }
}

export const listDir: Tool = {
  definition: {
    name: 'list_dir',
    description:
      'List files and directories at a path relative to the working directory. Returns a JSON array of { name, type } objects, where type is one of: dir, file, symlink, block, char, fifo, socket, unknown. Paths that escape the working directory are rejected.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path (use "." for cwd)' },
      },
      required: ['path'],
    },
  },
  handler: async ({ path: p }) => {
    const rel = p as string;
    const full = safeResolve(rel);
    const entries = await fs.readdir(full, { withFileTypes: true });
    const payload = entries.map((e) => ({
      name: e.name,
      type: direntType(e),
    }));
    return {
      content: JSON.stringify(payload, null, 2),
      display: `${rel} (${payload.length} entries)`,
    };
  },
};
