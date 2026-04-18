import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { BASH_MAX_BUFFER, BASH_TIMEOUT_MS } from '../config';
import type { Tool } from '../types';

const execAsync = promisify(exec);

type ExecError = Error & {
  code?: number;
  signal?: NodeJS.Signals | null;
  stdout?: string;
  stderr?: string;
  killed?: boolean;
};

export const bash: Tool = {
  definition: {
    name: 'bash',
    description:
      `Run a shell command in the working directory and capture its output. ` +
      `Runs via /bin/sh with a ${BASH_TIMEOUT_MS} ms timeout and a ${BASH_MAX_BUFFER}-byte combined stdout+stderr cap. ` +
      `Use for git, build tools, tests, and other OS utilities. Prefer the dedicated read_file / write_file / list_dir tools for filesystem work. ` +
      `Returns JSON: { ok, exitCode, stdout, stderr, timedOut }.`,
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Shell command to execute (passed to /bin/sh -c).',
        },
      },
      required: ['command'],
    },
  },
  handler: async ({ command }) => {
    const cmd = command as string;
    if (typeof cmd !== 'string' || cmd.length === 0) {
      throw new Error('command must be a non-empty string.');
    }
    const short = cmd.length > 60 ? `${cmd.slice(0, 57)}...` : cmd;
    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: process.cwd(),
        timeout: BASH_TIMEOUT_MS,
        maxBuffer: BASH_MAX_BUFFER,
        shell: '/bin/sh',
      });
      return {
        content: JSON.stringify(
          { ok: true, exitCode: 0, stdout, stderr, timedOut: false },
          null,
          2,
        ),
        display: `$ ${short} (exit 0)`,
      };
    } catch (err) {
      const e = err as ExecError;
      const timedOut = e.killed === true && e.signal === 'SIGTERM';
      const exitCode = typeof e.code === 'number' ? e.code : null;
      return {
        content: JSON.stringify(
          {
            ok: false,
            exitCode,
            signal: e.signal ?? null,
            stdout: e.stdout ?? '',
            stderr: e.stderr ?? e.message,
            timedOut,
          },
          null,
          2,
        ),
        display: `$ ${short} (${timedOut ? 'timed out' : `exit ${exitCode ?? e.signal ?? 'error'}`})`,
      };
    }
  },
};
