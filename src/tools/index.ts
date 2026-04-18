import type { Tool } from '../types';
import { readFile } from './read-file';
import { writeFile } from './write-file';
import { listDir } from './list-dir';
import { bash } from './bash';

export const tools: Tool[] = [readFile, writeFile, listDir, bash];

export const toolMap = new Map(tools.map((t) => [t.definition.name, t]));

export const toolDefinitions = tools.map((t) => t.definition);
