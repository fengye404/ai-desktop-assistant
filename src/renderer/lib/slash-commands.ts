export interface ParsedSlashCommand {
  raw: string;
  name: string;
  args: string[];
}

export interface SlashCommandDefinition {
  name: string;
  usage: string;
  description: string;
}

export const BUILT_IN_SLASH_COMMANDS: SlashCommandDefinition[] = [
  {
    name: 'help',
    usage: '/help',
    description: '显示内置命令帮助',
  },
  {
    name: 'clear',
    usage: '/clear',
    description: '清空当前会话',
  },
  {
    name: 'compact',
    usage: '/compact',
    description: '压缩历史上下文，保留关键记录',
  },
  {
    name: 'config',
    usage: '/config',
    description: '打开设置面板',
  },
  {
    name: 'model',
    usage: '/model <model-id>',
    description: '切换当前模型',
  },
];

export function parseSlashCommand(input: string): ParsedSlashCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }

  const withoutPrefix = trimmed.slice(1).trim();
  if (!withoutPrefix) {
    return null;
  }

  const segments = withoutPrefix.split(/\s+/).filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  const [name, ...args] = segments;
  return {
    raw: trimmed,
    name: name.toLowerCase(),
    args,
  };
}

export function formatSlashCommandHelp(): string {
  const lines = [
    '可用斜杠命令:',
    ...BUILT_IN_SLASH_COMMANDS.map((command) => `- \`${command.usage}\`：${command.description}`),
    '',
    '补充:',
    '- 支持 `@路径` 引用文件，例如 `@src/main.ts` 或 `@src/main.ts:10-40`',
  ];

  return lines.join('\n');
}

export function getSlashCommandSuggestions(query: string): SlashCommandDefinition[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return BUILT_IN_SLASH_COMMANDS;
  }

  return BUILT_IN_SLASH_COMMANDS
    .filter((command) => command.name.startsWith(normalizedQuery))
    .sort((left, right) => left.name.localeCompare(right.name));
}
