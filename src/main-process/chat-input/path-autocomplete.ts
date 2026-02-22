import * as fs from 'fs';
import * as path from 'path';
import type { PathAutocompleteItem } from '../../types';

const MAX_SUGGESTIONS = 40;

function normalizeInputPath(value: string): string {
  return value.replace(/\\/g, '/').trim();
}

function toNormalizedRelativePath(value: string): string {
  const normalized = path.posix.normalize(value.replace(/\\/g, '/'));
  if (normalized === '.') {
    return '';
  }
  if (normalized === '..' || normalized.startsWith('../')) {
    return '..';
  }
  return normalized.replace(/^\/+/, '');
}

function isInsideWorkspace(workspaceRoot: string, absolutePath: string): boolean {
  const relative = path.relative(workspaceRoot, absolutePath);
  if (!relative) return true;
  if (relative.startsWith('..')) return false;
  return !path.isAbsolute(relative);
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

function resolveDirectoryWithFallback(baseDir: string, relativePath: string): string | null {
  const normalized = toNormalizedRelativePath(relativePath);
  if (normalized === '..') {
    return null;
  }
  if (!normalized) {
    return baseDir;
  }

  const segments = normalized.split('/').filter(Boolean);
  let current = baseDir;
  for (const segment of segments) {
    const next = resolveCaseInsensitiveChild(current, segment);
    if (!next) {
      return null;
    }
    current = next;
  }

  return current;
}

function splitInputPath(inputPath: string): { directoryPart: string; namePart: string } {
  if (!inputPath) {
    return { directoryPart: '', namePart: '' };
  }

  if (inputPath.endsWith('/')) {
    return { directoryPart: inputPath, namePart: '' };
  }

  const lastSlashIndex = inputPath.lastIndexOf('/');
  if (lastSlashIndex < 0) {
    return { directoryPart: '', namePart: inputPath };
  }

  return {
    directoryPart: inputPath.slice(0, lastSlashIndex + 1),
    namePart: inputPath.slice(lastSlashIndex + 1),
  };
}

export class PathAutocompleteService {
  private readonly workspaceRoot: string;
  private readonly filesystemRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.filesystemRoot = path.parse(this.workspaceRoot).root || '/';
  }

  suggest(partialPath: string): PathAutocompleteItem[] {
    const normalizedInput = normalizeInputPath(partialPath);
    const rooted = normalizedInput.startsWith('/');
    const relativeInput = normalizedInput.replace(/^\/+/, '');

    const { directoryPart, namePart } = splitInputPath(relativeInput);
    const candidateDirectory = directoryPart || '.';
    const baseDir = rooted ? this.filesystemRoot : this.workspaceRoot;
    const absoluteDirectory = resolveDirectoryWithFallback(baseDir, candidateDirectory);
    if (!absoluteDirectory) {
      return [];
    }

    if (!rooted && !isInsideWorkspace(this.workspaceRoot, absoluteDirectory)) {
      return [];
    }

    const directoryStats = fs.statSync(absoluteDirectory);
    if (!directoryStats.isDirectory()) {
      return [];
    }

    const lowerNamePart = namePart.toLowerCase();
    const includeHidden = namePart.startsWith('.');
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(absoluteDirectory, { withFileTypes: true });
    } catch {
      return [];
    }

    const suggestions = entries
      .filter((entry) => {
        if (!includeHidden && entry.name.startsWith('.')) {
          return false;
        }
        if (!namePart) {
          return true;
        }
        return entry.name.toLowerCase().startsWith(lowerNamePart);
      })
      .sort((left, right) => {
        const leftDirRank = left.isDirectory() ? 0 : 1;
        const rightDirRank = right.isDirectory() ? 0 : 1;
        if (leftDirRank !== rightDirRank) {
          return leftDirRank - rightDirRank;
        }
        return left.name.localeCompare(right.name);
      })
      .slice(0, MAX_SUGGESTIONS)
      .map<PathAutocompleteItem>((entry) => {
        const prefix = directoryPart;
        const rawValue = `${prefix}${entry.name}`;
        const valueWithTypeSuffix = entry.isDirectory() ? `${rawValue}/` : rawValue;
        const value = rooted ? `/${valueWithTypeSuffix}` : valueWithTypeSuffix;
        return {
          value,
          isDirectory: entry.isDirectory(),
        };
      });

    return suggestions;
  }
}
