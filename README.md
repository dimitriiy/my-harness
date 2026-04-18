# Custom LLM Harness

A minimal terminal chat harness for the Anthropic API, written in TypeScript. It
wraps the agent loop (prompt → `tool_use` → `tool_result` → repeat) around a
small set of local tools so Claude can read, write, list, and shell out inside
the project directory.

## Features

- REPL chat with persistent in-process history (trimmed at safe turn boundaries)
- Markdown rendering of model replies (`cli-markdown`)
- Raw-mode input line with gray-highlight background, wide-char / emoji width
  handling, arrow keys, Home/End, Delete, Ctrl-A/E, window resize
- "Thinking" spinner with randomized verbs
- Tool calls shown as one-line summaries (`[Tool call] bold_name details`)
- Sandboxed filesystem tools (no absolute paths, no `..` escapes, write size
  cap)
- Bash tool with cwd, timeout, and output-buffer caps

## Requirements

- Node.js 20+
- An Anthropic API key

## Setup

```sh
npm install
cp .env.local.example .env.local
# edit .env.local and set ANTHROPIC_API_KEY
```

## Run

```sh
npm start        # the REPL
npm run typecheck
```

Type `/exit` to leave the REPL. Ctrl-C also works.

## Project layout

```
src/
  index.ts             REPL entry
  client.ts            Anthropic SDK instance
  config.ts            model, token, size, and timeout constants
  input.ts             raw-mode line reader with highlighted background
  render.ts            markdown → ANSI
  prompts/system.ts    system prompt
  agent/loop.ts        send → tool_use → tool_result loop
  tools/
    index.ts           registry (definitions + handler map)
    safe-path.ts       sandboxed path resolver
    read-file.ts       read_file
    write-file.ts      write_file (size-capped)
    list-dir.ts        list_dir (JSON { name, type })
    bash.ts            bash (/bin/sh -c, timeout, maxBuffer)
  types.ts             Tool / ToolResult types
  types/cli-markdown.d.ts
quickstart.ts          minimal non-REPL API call
```

## Tools

Each tool handler returns `{ content, display }`. `content` goes back to the
model as `tool_result`; `display` is a one-line terminal summary.

| Tool         | Input             | Notes                                                |
| ------------ | ----------------- | ---------------------------------------------------- |
| `read_file`  | `path`            | UTF-8 text, relative path only                       |
| `write_file` | `path`, `content` | Creates parents, rejects > `MAX_WRITE_BYTES`         |
| `list_dir`   | `path`            | Returns JSON `[{ name, type }]` for all Dirent kinds |
| `bash`       | `command`         | `/bin/sh -c`, `BASH_TIMEOUT_MS`, `BASH_MAX_BUFFER`   |

All filesystem tools run through `safeResolve()`, which rejects absolute paths
and any path that resolves outside `process.cwd()`.

## Configuration

Edit `src/config.ts`:

- `MODEL` — Anthropic model ID
- `MAX_TOKENS` — per-response token cap
- `MAX_WRITE_BYTES` — write_file size cap (default 1 MB)
- `MAX_HISTORY_TURNS` — REPL history cap (default 40)
- `BASH_TIMEOUT_MS` — bash hard timeout (default 30 s)
- `BASH_MAX_BUFFER` — bash combined stdout+stderr cap (default 1 MB)

## Security notes

- `.env.local` is gitignored.
- Filesystem tools are sandboxed to the working directory.
- The `bash` tool has **no command allowlist** — it can run anything reachable
  from `/bin/sh`. Only point the harness at projects where that is acceptable.
