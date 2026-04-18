import { stdin, stdout } from 'node:process';
import stringWidth from 'string-width';

const BG = '\x1b[100m\x1b[97m'; // gray bg, white text
const RESET = '\x1b[0m';
const PROMPT = '> ';

const isHighSurrogate = (c: number) => c >= 0xd800 && c <= 0xdbff;
const isLowSurrogate = (c: number) => c >= 0xdc00 && c <= 0xdfff;

// Number of UTF-16 units for the code point starting at idx.
function codePointUnitsAt(s: string, idx: number): number {
  if (idx < 0 || idx >= s.length) return 0;
  if (
    isHighSurrogate(s.charCodeAt(idx)) &&
    idx + 1 < s.length &&
    isLowSurrogate(s.charCodeAt(idx + 1))
  ) {
    return 2;
  }
  return 1;
}

// Number of UTF-16 units for the code point ending at idx (i.e. before the
// cursor). Returns 0 if idx is 0.
function codePointUnitsBefore(s: string, idx: number): number {
  if (idx <= 0) return 0;
  if (
    isLowSurrogate(s.charCodeAt(idx - 1)) &&
    idx >= 2 &&
    isHighSurrogate(s.charCodeAt(idx - 2))
  ) {
    return 2;
  }
  return 1;
}

// Reads a single line from stdin in raw mode with a gray background that
// spans the full terminal width (including wrapped rows). Supports arrow
// keys, Home/End, Delete, Backspace, Ctrl-C, window resize, and wide chars.
export function readLineHighlighted(): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = '';
    let cursor = 0; // UTF-16 unit index into buf
    let prevRows = 1;

    const getLayout = () => {
      const cols = Math.max(1, stdout.columns ?? 80);
      const content = `${PROMPT}${buf}`;
      const width = stringWidth(content);
      const rows = Math.max(1, Math.ceil((width + 1) / cols));
      const cursorWidth = stringWidth(PROMPT + buf.slice(0, cursor));
      const targetRow = Math.floor(cursorWidth / cols);
      const targetCol = cursorWidth % cols;
      return { cols, content, width, rows, targetRow, targetCol };
    };

    const redraw = () => {
      const { cols, content, width, rows, targetRow, targetCol } = getLayout();

      if (prevRows > 1) stdout.write(`\x1b[${prevRows - 1}A`);
      stdout.write('\r\x1b[0J');

      const padding = Math.max(0, rows * cols - width);
      stdout.write(`${BG}${content}${' '.repeat(padding)}${RESET}`);

      stdout.write('\r');
      const rowsUp = rows - 1 - targetRow;
      if (rowsUp > 0) stdout.write(`\x1b[${rowsUp}A`);
      if (targetCol > 0) stdout.write(`\x1b[${targetCol}C`);

      prevRows = rows;
    };

    const onResize = () => {
      prevRows = 1; // can't trust prior layout after resize; start fresh
      stdout.write('\r\x1b[0J');
      redraw();
    };

    const cleanup = () => {
      stdout.off('resize', onResize);
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
    };

    const finish = () => {
      const { rows, targetRow } = getLayout();
      const rowsDown = rows - 1 - targetRow;
      if (rowsDown > 0) stdout.write(`\x1b[${rowsDown}B`);
      stdout.write('\r\n');
    };

    const insertChar = (ch: string) => {
      buf = buf.slice(0, cursor) + ch + buf.slice(cursor);
      cursor += ch.length;
    };

    const backspace = () => {
      const n = codePointUnitsBefore(buf, cursor);
      if (n === 0) return;
      buf = buf.slice(0, cursor - n) + buf.slice(cursor);
      cursor -= n;
    };

    const deleteChar = () => {
      const n = codePointUnitsAt(buf, cursor);
      if (n === 0) return;
      buf = buf.slice(0, cursor) + buf.slice(cursor + n);
    };

    const moveLeft = () => {
      cursor -= codePointUnitsBefore(buf, cursor);
    };

    const moveRight = () => {
      cursor += codePointUnitsAt(buf, cursor);
    };

    const onData = (data: Buffer) => {
      const str = data.toString('utf8');
      let i = 0;

      while (i < str.length) {
        const ch = str[i];
        const code = ch.charCodeAt(0);

        // CSI escape sequences: ESC [ ...
        if (ch === '\x1b' && str[i + 1] === '[') {
          const p2 = str[i + 2];
          const p3 = str[i + 3];

          if (p2 === 'D') { moveLeft(); redraw(); i += 3; continue; }
          if (p2 === 'C') { moveRight(); redraw(); i += 3; continue; }
          if (p2 === 'H') { cursor = 0; redraw(); i += 3; continue; }
          if (p2 === 'F') { cursor = buf.length; redraw(); i += 3; continue; }
          if (p2 === 'A' || p2 === 'B') { i += 3; continue; } // ignore up/down
          if (p2 === '3' && p3 === '~') { deleteChar(); redraw(); i += 4; continue; }
          if ((p2 === '1' || p2 === '7') && p3 === '~') { cursor = 0; redraw(); i += 4; continue; }
          if ((p2 === '4' || p2 === '8') && p3 === '~') { cursor = buf.length; redraw(); i += 4; continue; }

          // Unknown CSI — skip until terminator (letter or ~)
          let j = i + 2;
          while (j < str.length && !/[A-Za-z~]/.test(str[j])) j++;
          i = j + 1;
          continue;
        }

        if (ch === '\r' || ch === '\n') {
          cleanup();
          finish();
          resolve(buf);
          return;
        }

        if (ch === '\x03') {
          cleanup();
          finish();
          reject(new Error('Aborted'));
          return;
        }

        if (ch === '\x7f' || ch === '\b') { backspace(); redraw(); i++; continue; }
        if (ch === '\x01') { cursor = 0; redraw(); i++; continue; } // Ctrl-A
        if (ch === '\x05') { cursor = buf.length; redraw(); i++; continue; } // Ctrl-E

        if (ch === '\x1b') { i++; continue; }
        if (code < 0x20) { i++; continue; }

        // Consume a surrogate pair as one code point
        if (
          isHighSurrogate(code) &&
          i + 1 < str.length &&
          isLowSurrogate(str.charCodeAt(i + 1))
        ) {
          insertChar(ch + str[i + 1]);
          redraw();
          i += 2;
          continue;
        }

        insertChar(ch);
        redraw();
        i++;
      }
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
    stdout.on('resize', onResize);
    redraw();
  });
}
