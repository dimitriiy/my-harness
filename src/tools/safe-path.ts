import path from 'node:path';

// Resolves a model-supplied relative path against the sandbox root (cwd).
// Rejects absolute paths and any path that escapes the root via "..".
export function safeResolve(rel: string, root = process.cwd()): string {
  if (typeof rel !== 'string' || rel.length === 0) {
    throw new Error('Path must be a non-empty string.');
  }
  if (path.isAbsolute(rel)) {
    throw new Error(`Absolute paths are not allowed: ${rel}`);
  }
  const full = path.resolve(root, rel);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (full !== root && !full.startsWith(rootWithSep)) {
    throw new Error(`Path escapes sandbox: ${rel}`);
  }
  return full;
}
