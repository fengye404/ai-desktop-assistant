import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolDefinition, ToolResult } from './types';

const execAsync = promisify(exec);

/**
 * Built-in tool definitions
 */
export const BUILT_IN_TOOLS: ToolDefinition[] = [
  {
    name: 'read_file',
    description: '读取文件内容。可以读取文本文件、代码文件等。支持指定行范围。',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '要读取的文件路径（相对于工作目录或绝对路径）',
        },
        offset: {
          type: 'string',
          description: '开始读取的行号（从1开始，可选）',
        },
        limit: {
          type: 'string',
          description: '要读取的行数（可选，默认全部）',
        },
      },
      required: ['path'],
    },
    permission: 'allow',
  },
  {
    name: 'list_directory',
    description: '列出目录内容，显示文件和子目录。',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '要列出内容的目录路径',
        },
      },
      required: ['path'],
    },
    permission: 'allow',
  },
  {
    name: 'write_file',
    description: '创建或覆盖文件内容。',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '要写入的文件路径',
        },
        content: {
          type: 'string',
          description: '要写入的文件内容',
        },
      },
      required: ['path', 'content'],
    },
    permission: 'ask',
  },
  {
    name: 'edit_file',
    description: '精确字符串替换编辑文件。在文件中查找精确匹配的字符串并替换为新内容。',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '要编辑的文件路径',
        },
        old_string: {
          type: 'string',
          description: '要查找并替换的精确字符串（必须唯一匹配）',
        },
        new_string: {
          type: 'string',
          description: '替换后的新字符串',
        },
        replace_all: {
          type: 'string',
          description: '是否替换所有匹配项（可选，默认 false 只替换第一个）',
        },
      },
      required: ['path', 'old_string', 'new_string'],
    },
    permission: 'ask',
  },
  {
    name: 'run_command',
    description: '执行 shell 命令。可以运行系统命令、脚本等。',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: '要执行的命令',
        },
        cwd: {
          type: 'string',
          description: '命令执行的工作目录（可选）',
        },
        timeout: {
          type: 'string',
          description: '超时时间（毫秒，可选，默认30000）',
        },
      },
      required: ['command'],
    },
    permission: 'ask',
  },
  {
    name: 'search_files',
    description: '使用 glob 模式搜索文件路径。',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'glob 模式，如 "**/*.ts" 或 "src/**/*.js"',
        },
        cwd: {
          type: 'string',
          description: '搜索的根目录（可选）',
        },
      },
      required: ['pattern'],
    },
    permission: 'allow',
  },
  {
    name: 'grep_search',
    description: '使用正则表达式搜索文件内容。基于 ripgrep，高性能全文搜索。',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: '正则表达式模式',
        },
        path: {
          type: 'string',
          description: '搜索的目录或文件路径（可选，默认当前工作目录）',
        },
        glob: {
          type: 'string',
          description: '文件过滤 glob 模式，如 "*.ts" 或 "*.{js,jsx}"（可选）',
        },
        ignore_case: {
          type: 'string',
          description: '是否忽略大小写（可选，默认 false）',
        },
        context_lines: {
          type: 'string',
          description: '显示匹配行前后的上下文行数（可选，默认0）',
        },
        max_results: {
          type: 'string',
          description: '最大返回结果数（可选，默认50）',
        },
      },
      required: ['pattern'],
    },
    permission: 'allow',
  },
  {
    name: 'web_fetch',
    description: '获取网页内容。支持 HTTP/HTTPS 请求，返回网页的文本内容。',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '要获取的 URL 地址（必须以 http:// 或 https:// 开头）',
        },
        timeout: {
          type: 'string',
          description: '请求超时时间（毫秒，可选，默认10000）',
        },
      },
      required: ['url'],
    },
    permission: 'allow',
  },
  {
    name: 'get_system_info',
    description: '获取系统信息，包括操作系统、CPU、内存等。',
    input_schema: {
      type: 'object',
      properties: {},
    },
    permission: 'allow',
  },
];

/**
 * Tool executor class
 */
export class ToolExecutor {
  private workingDirectory: string;
  private permissionCallback: ((tool: string, input: Record<string, unknown>) => Promise<boolean>) | null = null;

  constructor(workingDirectory?: string) {
    this.workingDirectory = workingDirectory || process.cwd();
  }

  /**
   * Set permission callback for tools that require approval
   */
  setPermissionCallback(callback: (tool: string, input: Record<string, unknown>) => Promise<boolean>): void {
    this.permissionCallback = callback;
  }

  /**
   * Set working directory
   */
  setWorkingDirectory(dir: string): void {
    this.workingDirectory = dir;
  }

  /**
   * Get tool definitions for API
   */
  getToolDefinitions(): Array<{
    name: string;
    description: string;
    input_schema: ToolDefinition['input_schema'];
  }> {
    return BUILT_IN_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
    }));
  }

  /**
   * Execute a tool by name
   */
  async executeTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
    const toolDef = BUILT_IN_TOOLS.find((t) => t.name === name);
    if (!toolDef) {
      return { success: false, error: `Unknown tool: ${name}` };
    }

    // Check permission
    if (toolDef.permission === 'deny') {
      return { success: false, error: `Tool ${name} is disabled` };
    }

    if (toolDef.permission === 'ask' && this.permissionCallback) {
      const approved = await this.permissionCallback(name, input);
      if (!approved) {
        return { success: false, error: `Tool ${name} was not approved by user` };
      }
    }

    // Execute tool
    try {
      switch (name) {
        case 'read_file':
          return await this.readFile(
            input.path as string,
            input.offset as string | undefined,
            input.limit as string | undefined
          );
        case 'list_directory':
          return await this.listDirectory(input.path as string);
        case 'write_file':
          return await this.writeFile(input.path as string, input.content as string);
        case 'edit_file':
          return await this.editFile(
            input.path as string,
            input.old_string as string,
            input.new_string as string,
            input.replace_all as string | undefined
          );
        case 'run_command':
          return await this.runCommand(
            input.command as string,
            input.cwd as string | undefined,
            input.timeout as string | undefined
          );
        case 'search_files':
          return await this.searchFiles(input.pattern as string, input.cwd as string | undefined);
        case 'grep_search':
          return await this.grepSearch(
            input.pattern as string,
            input.path as string | undefined,
            input.glob as string | undefined,
            input.ignore_case as string | undefined,
            input.context_lines as string | undefined,
            input.max_results as string | undefined
          );
        case 'web_fetch':
          return await this.webFetch(
            input.url as string,
            input.timeout as string | undefined
          );
        case 'get_system_info':
          return await this.getSystemInfo();
        default:
          return { success: false, error: `Tool ${name} not implemented` };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Read file content with optional line range
   */
  private async readFile(filePath: string, offset?: string, limit?: string): Promise<ToolResult> {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.workingDirectory, filePath);

    if (!fs.existsSync(fullPath)) {
      return { success: false, error: `File not found: ${fullPath}` };
    }

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      return { success: false, error: `Path is a directory, not a file: ${fullPath}` };
    }

    // Check file size (limit to 1MB)
    if (stats.size > 1024 * 1024) {
      return { success: false, error: `File too large (> 1MB): ${fullPath}` };
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    // Apply offset and limit if provided
    const startLine = offset ? Math.max(1, parseInt(offset, 10)) : 1;
    const lineLimit = limit ? parseInt(limit, 10) : lines.length;

    const selectedLines = lines.slice(startLine - 1, startLine - 1 + lineLimit);

    // Add line numbers for reference
    const numberedLines = selectedLines.map((line, i) => {
      const lineNum = (startLine + i).toString().padStart(4, ' ');
      return `${lineNum}│ ${line}`;
    });

    return { success: true, output: numberedLines.join('\n') };
  }

  /**
   * List directory contents
   */
  private async listDirectory(dirPath: string): Promise<ToolResult> {
    const fullPath = path.isAbsolute(dirPath) ? dirPath : path.join(this.workingDirectory, dirPath);

    if (!fs.existsSync(fullPath)) {
      return { success: false, error: `Directory not found: ${fullPath}` };
    }

    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) {
      return { success: false, error: `Path is not a directory: ${fullPath}` };
    }

    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const listing = entries.map((entry) => {
      const type = entry.isDirectory() ? '[DIR]' : '[FILE]';
      return `${type} ${entry.name}`;
    });

    return { success: true, output: listing.join('\n') };
  }

  /**
   * Write file content
   */
  private async writeFile(filePath: string, content: string): Promise<ToolResult> {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.workingDirectory, filePath);

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf-8');
    return { success: true, output: `File written: ${fullPath}` };
  }

  /**
   * Run shell command
   */
  private async runCommand(command: string, cwd?: string, timeout?: string): Promise<ToolResult> {
    const workDir = cwd
      ? path.isAbsolute(cwd)
        ? cwd
        : path.join(this.workingDirectory, cwd)
      : this.workingDirectory;

    const timeoutMs = timeout ? parseInt(timeout, 10) : 30000;

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workDir,
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024, // 1MB buffer
      });

      let output = '';
      if (stdout) output += stdout;
      if (stderr) output += (output ? '\n--- stderr ---\n' : '') + stderr;

      return { success: true, output: output || '(no output)' };
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string; message: string };
      let output = '';
      if (execError.stdout) output += execError.stdout;
      if (execError.stderr) output += (output ? '\n--- stderr ---\n' : '') + execError.stderr;
      return {
        success: false,
        error: execError.message,
        output: output || undefined,
      };
    }
  }

  /**
   * Search files using glob pattern (simplified implementation)
   */
  private async searchFiles(pattern: string, cwd?: string): Promise<ToolResult> {
    const workDir = cwd
      ? path.isAbsolute(cwd)
        ? cwd
        : path.join(this.workingDirectory, cwd)
      : this.workingDirectory;

    // Use find command for simple glob matching
    const command = process.platform === 'win32'
      ? `dir /s /b "${pattern}"`
      : `find . -name "${pattern}" -type f 2>/dev/null | head -100`;

    try {
      const { stdout } = await execAsync(command, {
        cwd: workDir,
        timeout: 10000,
      });

      const files = stdout.trim().split('\n').filter(Boolean);
      if (files.length === 0) {
        return { success: true, output: 'No files found matching pattern' };
      }

      return { success: true, output: files.join('\n') };
    } catch {
      return { success: true, output: 'No files found matching pattern' };
    }
  }

  /**
   * Get system information
   */
  private async getSystemInfo(): Promise<ToolResult> {
    const os = await import('os');

    const info = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMemory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
      freeMemory: `${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB`,
      uptime: `${Math.round(os.uptime() / 3600)} hours`,
      nodeVersion: process.version,
      cwd: this.workingDirectory,
    };

    const output = Object.entries(info)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    return { success: true, output };
  }

  /**
   * Edit file with exact string replacement
   */
  private async editFile(
    filePath: string,
    oldString: string,
    newString: string,
    replaceAll?: string
  ): Promise<ToolResult> {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.workingDirectory, filePath);

    if (!fs.existsSync(fullPath)) {
      return { success: false, error: `File not found: ${fullPath}` };
    }

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      return { success: false, error: `Path is a directory, not a file: ${fullPath}` };
    }

    const content = fs.readFileSync(fullPath, 'utf-8');

    // Check if old_string exists in the file
    if (!content.includes(oldString)) {
      return { success: false, error: `String not found in file: "${oldString.substring(0, 50)}${oldString.length > 50 ? '...' : ''}"` };
    }

    // Check uniqueness if not replace_all
    const shouldReplaceAll = replaceAll === 'true';
    if (!shouldReplaceAll) {
      const occurrences = content.split(oldString).length - 1;
      if (occurrences > 1) {
        return {
          success: false,
          error: `String appears ${occurrences} times in file. Use replace_all: "true" to replace all occurrences, or provide a more unique string.`,
        };
      }
    }

    // Perform replacement
    let newContent: string;
    if (shouldReplaceAll) {
      newContent = content.split(oldString).join(newString);
    } else {
      newContent = content.replace(oldString, newString);
    }

    fs.writeFileSync(fullPath, newContent, 'utf-8');

    const replacements = shouldReplaceAll ? content.split(oldString).length - 1 : 1;
    return { success: true, output: `File edited: ${fullPath} (${replacements} replacement${replacements > 1 ? 's' : ''})` };
  }

  /**
   * Search file contents using regex (grep-like)
   */
  private async grepSearch(
    pattern: string,
    searchPath?: string,
    glob?: string,
    ignoreCase?: string,
    contextLines?: string,
    maxResults?: string
  ): Promise<ToolResult> {
    const workDir = searchPath
      ? path.isAbsolute(searchPath)
        ? searchPath
        : path.join(this.workingDirectory, searchPath)
      : this.workingDirectory;

    // Build command - prefer ripgrep (rg) if available, fallback to grep
    const caseFlag = ignoreCase === 'true' ? '-i' : '';
    const contextFlag = contextLines ? `-C ${parseInt(contextLines, 10)}` : '';
    const maxFlag = maxResults ? `-m ${parseInt(maxResults, 10)}` : '-m 50';
    const globFlag = glob ? `--glob "${glob}"` : '';

    // Try ripgrep first, then grep
    const rgCommand = `rg ${caseFlag} ${contextFlag} ${maxFlag} ${globFlag} -n "${pattern}" "${workDir}" 2>/dev/null`;
    const grepCommand = `grep -r ${caseFlag} ${contextFlag} -n "${pattern}" "${workDir}" 2>/dev/null | head -${maxResults || 50}`;

    try {
      // Try ripgrep first
      const { stdout } = await execAsync(rgCommand, {
        cwd: workDir,
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      });

      if (!stdout.trim()) {
        return { success: true, output: 'No matches found' };
      }
      return { success: true, output: stdout.trim() };
    } catch {
      // Fallback to grep
      try {
        const { stdout } = await execAsync(grepCommand, {
          cwd: workDir,
          timeout: 30000,
          maxBuffer: 1024 * 1024,
        });

        if (!stdout.trim()) {
          return { success: true, output: 'No matches found' };
        }
        return { success: true, output: stdout.trim() };
      } catch {
        return { success: true, output: 'No matches found' };
      }
    }
  }

  /**
   * Fetch web page content
   */
  private async webFetch(url: string, timeout?: string): Promise<ToolResult> {
    // Validate URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { success: false, error: 'URL must start with http:// or https://' };
    }

    const timeoutMs = timeout ? parseInt(timeout, 10) : 10000;

    try {
      // Use native fetch (available in Node.js 18+)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AI-Desktop-Assistant/1.0)',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const contentType = response.headers.get('content-type') || '';
      
      // Only handle text content
      if (!contentType.includes('text') && !contentType.includes('json') && !contentType.includes('xml')) {
        return { success: false, error: `Unsupported content type: ${contentType}` };
      }

      const text = await response.text();

      // Limit response size
      const maxLength = 50000;
      if (text.length > maxLength) {
        return {
          success: true,
          output: text.substring(0, maxLength) + '\n\n... (truncated, total length: ' + text.length + ' characters)',
        };
      }

      return { success: true, output: text };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('abort')) {
        return { success: false, error: `Request timeout (${timeoutMs}ms)` };
      }
      return { success: false, error: errorMessage };
    }
  }
}
