import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

export interface SessionTranscriptCleanupResult {
  filesScanned: number;
  filesUpdated: number;
  entriesRemoved: number;
  backupsCreated: number;
}

function getClaudeProjectDir(workspaceRoot: string): string {
  const projectKey = workspaceRoot.replace(/[\\/]/g, '-');
  return path.join(os.homedir(), '.claude', 'projects', projectKey);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEmptyToolResultContent(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.every((part) => {
      if (!isRecord(part)) return false;
      if (part.type !== 'text') return false;
      return typeof part.text === 'string' && part.text.trim().length === 0;
    });
  }

  return value === null || value === undefined;
}

/**
 * Remove SDK user records that only contain empty non-error tool_result blocks.
 * These records currently map to empty chat bubbles in the app and carry no
 * displayable payload for users.
 */
function shouldDropEntry(raw: unknown): boolean {
  if (!isRecord(raw)) return false;
  if (raw.type !== 'user') return false;
  if (!isRecord(raw.message)) return false;

  const message = raw.message;
  if (message.role !== 'user') return false;
  if (!Array.isArray(message.content) || message.content.length === 0) return false;

  let hasToolResult = false;

  for (const block of message.content) {
    if (!isRecord(block)) return false;

    const blockType = block.type;
    if (blockType === 'text') {
      if (typeof block.text !== 'string' || block.text.trim().length > 0) return false;
      continue;
    }

    if (blockType === 'tool_result') {
      hasToolResult = true;
      if (block.is_error === true) return false;
      if (!isEmptyToolResultContent(block.content)) return false;
      continue;
    }

    // Keep any other block types intact.
    return false;
  }

  return hasToolResult;
}

async function cleanupJsonlFile(filePath: string): Promise<{ changed: boolean; removed: number; backupCreated: boolean }> {
  const stat = await fs.stat(filePath);
  const raw = await fs.readFile(filePath, 'utf8');
  const hadTrailingNewline = raw.endsWith('\n');
  const lines = raw.split(/\r?\n/);

  const kept: string[] = [];
  let removed = 0;

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const parsed = JSON.parse(line) as unknown;
      if (shouldDropEntry(parsed)) {
        removed += 1;
        continue;
      }
    } catch {
      // Keep malformed lines untouched to avoid risking transcript damage.
    }

    kept.push(line);
  }

  if (removed === 0) {
    return { changed: false, removed: 0, backupCreated: false };
  }

  const backupPath = `${filePath}.bak-empty-cleanup-${Date.now()}`;
  await fs.copyFile(filePath, backupPath);

  const nextContent = kept.join('\n') + (hadTrailingNewline && kept.length > 0 ? '\n' : '');
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, nextContent, { mode: stat.mode });
  await fs.rename(tempPath, filePath);

  return { changed: true, removed, backupCreated: true };
}

export async function cleanupEmptySdkSessionMessages(workspaceRoot: string): Promise<SessionTranscriptCleanupResult> {
  const result: SessionTranscriptCleanupResult = {
    filesScanned: 0,
    filesUpdated: 0,
    entriesRemoved: 0,
    backupsCreated: 0,
  };

  const projectDir = getClaudeProjectDir(workspaceRoot);

  let names: string[] = [];
  try {
    names = await fs.readdir(projectDir);
  } catch {
    return result;
  }

  for (const name of names) {
    if (!name.endsWith('.jsonl')) continue;
    const filePath = path.join(projectDir, name);
    result.filesScanned += 1;

    try {
      const { changed, removed, backupCreated } = await cleanupJsonlFile(filePath);
      if (changed) result.filesUpdated += 1;
      result.entriesRemoved += removed;
      if (backupCreated) result.backupsCreated += 1;
    } catch (error) {
      console.warn('[session-transcript-cleaner] Failed to cleanup file:', filePath, error);
    }
  }

  return result;
}
