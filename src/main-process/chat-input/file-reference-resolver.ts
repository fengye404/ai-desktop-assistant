import * as fs from 'fs';
import * as path from 'path';

const FILE_REFERENCE_PATTERN = /(^|[^A-Za-z0-9_/@.-])@([A-Za-z0-9_./\\-]+)(?::(\d+)(?:-(\d+))?)?/g;

const MAX_REFERENCES_PER_MESSAGE = 8;
const MAX_FILE_SIZE_BYTES = 512 * 1024;
const MAX_FILE_LINES = 220;
const MAX_DIRECTORY_ENTRIES = 120;
const MAX_INJECTED_CHARS = 45000;
const DIRECTORY_TREE_MAX_DEPTH = 2;

interface ParsedReference {
  raw: string;
  targetPath: string;
  startLine?: number;
  endLine?: number;
}

interface ResolvedReferenceBlock {
  block: string;
  chars: number;
  resolved: boolean;
}

export interface ResolvedUserMessage {
  originalMessage: string;
  modelMessage: string;
  hasReferences: boolean;
  resolvedCount: number;
}

function toPositiveInteger(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function trimSummaryLine(line: string, maxLength = 220): string {
  const normalized = line.replace(/\t/g, '  ');
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}...`;
}

function toWorkspaceRelativePath(workspaceRoot: string, absolutePath: string): string {
  const relative = path.relative(workspaceRoot, absolutePath);
  return relative ? relative.split(path.sep).join('/') : '.';
}

function normalizeReferencePath(targetPath: string): string {
  const normalized = targetPath
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '');
  if (normalized.startsWith('/')) {
    return path.posix.normalize(normalized);
  }
  return normalized;
}

function normalizeRelativePathForWorkspace(value: string): string | null {
  const normalized = path.posix.normalize(value.replace(/\\/g, '/'));
  if (normalized === '.' || normalized === '') {
    return '';
  }
  if (normalized === '..' || normalized.startsWith('../')) {
    return null;
  }
  return normalized.replace(/^\/+/, '');
}

function resolveCaseInsensitiveChild(parentDir: string, segment: string): string | null {
  const exactPath = path.join(parentDir, segment);
  if (fs.existsSync(exactPath)) {
    return exactPath;
  }

  try {
    const entries = fs.readdirSync(parentDir);
    const matched = entries.find((entry) => entry.toLowerCase() === segment.toLowerCase());
    if (!matched) {
      return null;
    }
    return path.join(parentDir, matched);
  } catch {
    return null;
  }
}

function resolveAbsolutePathWithFallback(targetPath: string): string | null {
  const normalizedAbsolutePath = path.resolve(targetPath);
  const parsed = path.parse(normalizedAbsolutePath);
  const root = parsed.root || '/';
  const relativeFromRoot = path.relative(root, normalizedAbsolutePath);

  if (!relativeFromRoot) {
    return root;
  }

  const segments = relativeFromRoot.split(path.sep).filter(Boolean);
  let current = root;
  for (const segment of segments) {
    const next = resolveCaseInsensitiveChild(current, segment);
    if (!next) {
      return null;
    }
    current = next;
  }
  return current;
}

function resolveWorkspacePathWithFallback(workspaceRoot: string, targetPath: string): string | null {
  const normalizedRelativePath = normalizeRelativePathForWorkspace(targetPath);
  if (normalizedRelativePath === null) {
    return null;
  }
  if (!normalizedRelativePath) {
    return workspaceRoot;
  }

  const segments = normalizedRelativePath.split('/').filter(Boolean);
  let current = workspaceRoot;
  for (const segment of segments) {
    const next = resolveCaseInsensitiveChild(current, segment);
    if (!next) {
      return null;
    }
    current = next;
  }
  return current;
}

function toDisplayPath(workspaceRoot: string, absolutePath: string): string {
  if (isInsideWorkspace(workspaceRoot, absolutePath)) {
    return toWorkspaceRelativePath(workspaceRoot, absolutePath);
  }
  return absolutePath.split(path.sep).join('/');
}

function isInsideWorkspace(workspaceRoot: string, absolutePath: string): boolean {
  const relative = path.relative(workspaceRoot, absolutePath);
  if (!relative) return true;
  if (relative.startsWith('..')) return false;
  return !path.isAbsolute(relative);
}

function parseReferences(message: string): ParsedReference[] {
  const references: ParsedReference[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = FILE_REFERENCE_PATTERN.exec(message)) !== null) {
    const rawPath = match[2];
    if (!rawPath) {
      continue;
    }

    const targetPath = rawPath.replace(/\\/g, '/');
    const startLine = toPositiveInteger(match[3]);
    const endLine = toPositiveInteger(match[4]);
    const raw = `@${targetPath}${startLine ? `:${startLine}${endLine ? `-${endLine}` : ''}` : ''}`;

    const dedupeKey = `${targetPath}::${startLine ?? ''}::${endLine ?? ''}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    references.push({
      raw,
      targetPath,
      startLine,
      endLine,
    });

    if (references.length >= MAX_REFERENCES_PER_MESSAGE) {
      break;
    }
  }

  return references;
}

function renderDirectoryTree(
  absoluteDirPath: string,
  baseDirPath: string,
  depth: number,
  counters: { entries: number; truncated: boolean },
  lines: string[],
): void {
  if (depth > DIRECTORY_TREE_MAX_DEPTH || counters.entries >= MAX_DIRECTORY_ENTRIES) {
    counters.truncated = true;
    return;
  }

  const entries = fs.readdirSync(absoluteDirPath, { withFileTypes: true })
    .sort((a, b) => {
      const aIsDir = a.isDirectory() ? 0 : 1;
      const bIsDir = b.isDirectory() ? 0 : 1;
      if (aIsDir !== bIsDir) return aIsDir - bIsDir;
      return a.name.localeCompare(b.name);
    });

  for (const entry of entries) {
    if (counters.entries >= MAX_DIRECTORY_ENTRIES) {
      counters.truncated = true;
      return;
    }

    counters.entries += 1;
    const nextAbsolutePath = path.join(absoluteDirPath, entry.name);
    const relativePath = toWorkspaceRelativePath(baseDirPath, nextAbsolutePath);
    lines.push(`${entry.isDirectory() ? '[DIR] ' : '[FILE]'}${relativePath}`);

    if (entry.isDirectory()) {
      renderDirectoryTree(nextAbsolutePath, baseDirPath, depth + 1, counters, lines);
    }
  }
}

export class FileReferenceResolver {
  private readonly workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  resolve(message: string): ResolvedUserMessage {
    const references = parseReferences(message);
    if (references.length === 0) {
      return {
        originalMessage: message,
        modelMessage: message,
        hasReferences: false,
        resolvedCount: 0,
      };
    }

    const blocks: string[] = [];
    let injectedChars = 0;
    let resolvedCount = 0;

    for (const reference of references) {
      const resolvedBlock = this.resolveSingleReference(reference);
      if (injectedChars + resolvedBlock.chars > MAX_INJECTED_CHARS) {
        blocks.push(
          `[引用 ${reference.raw}] 已跳过：注入上下文已达到 ${MAX_INJECTED_CHARS} 字符上限。`,
        );
        break;
      }

      blocks.push(resolvedBlock.block);
      injectedChars += resolvedBlock.chars;
      if (resolvedBlock.resolved) {
        resolvedCount += 1;
      }
    }

    const appendedContext = [
      '',
      '[以下为 @ 文件引用自动注入的上下文，请优先参考这些内容回答]',
      ...blocks,
    ].join('\n\n');

    return {
      originalMessage: message,
      modelMessage: `${message}${appendedContext}`,
      hasReferences: true,
      resolvedCount,
    };
  }

  private resolveSingleReference(reference: ParsedReference): ResolvedReferenceBlock {
    const normalizedTargetPath = normalizeReferencePath(reference.targetPath);
    const isAbsoluteReference = path.isAbsolute(normalizedTargetPath);
    const absolutePath = isAbsoluteReference
      ? resolveAbsolutePathWithFallback(normalizedTargetPath)
      : resolveWorkspacePathWithFallback(this.workspaceRoot, normalizedTargetPath);

    if (!absolutePath) {
      const block = [
        `[引用 ${reference.raw}]`,
        '状态: 失败',
        `原因: 文件或目录不存在 (${normalizedTargetPath || reference.targetPath})。`,
      ].join('\n');
      return { block, chars: block.length, resolved: false };
    }

    if (!isAbsoluteReference && !isInsideWorkspace(this.workspaceRoot, absolutePath)) {
      const block = [
        `[引用 ${reference.raw}]`,
        '状态: 失败',
        '原因: 路径超出当前工作目录，不允许读取。',
      ].join('\n');
      return { block, chars: block.length, resolved: false };
    }

    const stats = fs.statSync(absolutePath);
    if (stats.isDirectory()) {
      return this.resolveDirectory(reference, absolutePath);
    }

    if (stats.size > MAX_FILE_SIZE_BYTES) {
      const block = [
        `[引用 ${reference.raw}]`,
        '状态: 失败',
        `原因: 文件过大 (${Math.round(stats.size / 1024)}KB)，超出 ${Math.round(MAX_FILE_SIZE_BYTES / 1024)}KB 限制。`,
      ].join('\n');
      return { block, chars: block.length, resolved: false };
    }

    return this.resolveFile(reference, absolutePath);
  }

  private resolveDirectory(reference: ParsedReference, absolutePath: string): ResolvedReferenceBlock {
    const displayPath = toDisplayPath(this.workspaceRoot, absolutePath);
    const treeLines: string[] = [];
    const counters = { entries: 0, truncated: false };
    const treeBasePath = isInsideWorkspace(this.workspaceRoot, absolutePath)
      ? this.workspaceRoot
      : absolutePath;
    renderDirectoryTree(absolutePath, treeBasePath, 0, counters, treeLines);

    const lines = [
      `[引用 ${reference.raw}]`,
      '状态: 成功',
      `类型: 目录 (${displayPath})`,
      `包含条目: ${treeLines.length}`,
      ...treeLines,
    ];

    if (counters.truncated) {
      lines.push(`(目录列表已截断，最多展示 ${MAX_DIRECTORY_ENTRIES} 项)`);
    }

    const block = lines.join('\n');
    return { block, chars: block.length, resolved: true };
  }

  private resolveFile(reference: ParsedReference, absolutePath: string): ResolvedReferenceBlock {
    const displayPath = toDisplayPath(this.workspaceRoot, absolutePath);
    const content = fs.readFileSync(absolutePath, 'utf-8');
    if (content.includes('\u0000')) {
      const block = [
        `[引用 ${reference.raw}]`,
        '状态: 失败',
        `原因: 文件可能为二进制，无法按文本读取 (${displayPath})。`,
      ].join('\n');
      return { block, chars: block.length, resolved: false };
    }

    const lines = content.split('\n');
    let start = reference.startLine ?? 1;
    let end = reference.endLine ?? (reference.startLine ? reference.startLine : lines.length);

    if (start > end) {
      [start, end] = [end, start];
    }

    start = Math.max(1, start);
    end = Math.min(lines.length, end);
    if (start > end) {
      start = end;
    }

    const requestedLineCount = Math.max(0, end - start + 1);
    const selectedLineCount = Math.min(requestedLineCount, MAX_FILE_LINES);
    const selectedEndLine = start + selectedLineCount - 1;

    const selectedLines = lines
      .slice(start - 1, selectedEndLine)
      .map((line, index) => {
        const lineNumber = String(start + index).padStart(4, ' ');
        return `${lineNumber}| ${trimSummaryLine(line)}`;
      });

    const blockLines = [
      `[引用 ${reference.raw}]`,
      '状态: 成功',
      `类型: 文件 (${displayPath})`,
      `行范围: ${start}-${selectedEndLine}`,
      ...selectedLines,
    ];

    if (requestedLineCount > selectedLineCount) {
      blockLines.push(`(内容已截断，单次最多注入 ${MAX_FILE_LINES} 行)`);
    }

    const block = blockLines.join('\n');
    return { block, chars: block.length, resolved: true };
  }
}
