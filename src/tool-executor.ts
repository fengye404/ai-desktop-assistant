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
    description: '读取文件内容。可以读取文本文件、代码文件等。',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '要读取的文件路径（相对于工作目录或绝对路径）',
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
      },
      required: ['command'],
    },
    permission: 'ask',
  },
  {
    name: 'search_files',
    description: '使用 glob 模式搜索文件。',
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
          return await this.readFile(input.path as string);
        case 'list_directory':
          return await this.listDirectory(input.path as string);
        case 'write_file':
          return await this.writeFile(input.path as string, input.content as string);
        case 'run_command':
          return await this.runCommand(input.command as string, input.cwd as string | undefined);
        case 'search_files':
          return await this.searchFiles(input.pattern as string, input.cwd as string | undefined);
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
   * Read file content
   */
  private async readFile(filePath: string): Promise<ToolResult> {
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
    return { success: true, output: content };
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
  private async runCommand(command: string, cwd?: string): Promise<ToolResult> {
    const workDir = cwd
      ? path.isAbsolute(cwd)
        ? cwd
        : path.join(this.workingDirectory, cwd)
      : this.workingDirectory;

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workDir,
        timeout: 30000, // 30 second timeout
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
}
