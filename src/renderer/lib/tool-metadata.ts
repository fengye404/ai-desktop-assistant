export interface ToolMeta {
  name: string;
  displayName: string;
  description: string;
  defaultAllowed: boolean;
}

export const TOOL_REGISTRY: ToolMeta[] = [
  { name: 'read_file', displayName: '读取文件', description: '读取项目中的文件内容', defaultAllowed: true },
  { name: 'write_file', displayName: '写入文件', description: '写入新文件或覆盖已有文件', defaultAllowed: false },
  { name: 'edit_file', displayName: '编辑文件', description: '对已有文件做局部修改', defaultAllowed: false },
  { name: 'list_directory', displayName: '列出目录', description: '浏览目录结构与文件列表', defaultAllowed: true },
  { name: 'search_files', displayName: '搜索文件', description: '按名称快速查找文件', defaultAllowed: true },
  { name: 'grep_search', displayName: '内容搜索', description: '按内容检索代码与文本', defaultAllowed: true },
  { name: 'run_command', displayName: '执行命令', description: '在终端执行命令', defaultAllowed: false },
  { name: 'web_fetch', displayName: '获取网页', description: '抓取并读取网页内容', defaultAllowed: true },
  { name: 'get_system_info', displayName: '系统信息', description: '读取运行环境与系统信息', defaultAllowed: true },
];

export const TOOL_DISPLAY_NAMES: Record<string, string> = Object.fromEntries([
  ...TOOL_REGISTRY.map((t) => [t.name, t.displayName]),
  ['Read', '读取文件'],
  ['Write', '写入文件'],
  ['Edit', '编辑文件'],
  ['MultiEdit', '批量编辑'],
  ['Bash', '执行命令'],
  ['Glob', '文件匹配'],
  ['Grep', '内容搜索'],
  ['WebSearch', '网页搜索'],
  ['WebFetch', '获取网页'],
  ['Task', '子任务'],
  ['TaskOutput', '任务输出'],
]);

export type ToolName = typeof TOOL_REGISTRY[number]['name'];
