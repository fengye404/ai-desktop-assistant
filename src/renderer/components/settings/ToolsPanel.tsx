import { Check, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConfigStore, ALL_TOOLS } from '@/stores/config-store';

const TOOL_DESCRIPTIONS: Record<string, string> = {
  read_file: '读取项目中的文件内容',
  write_file: '写入新文件或覆盖已有文件',
  edit_file: '对已有文件做局部修改',
  list_directory: '浏览目录结构与文件列表',
  search_files: '按名称快速查找文件',
  grep_search: '按内容检索代码与文本',
  run_command: '在终端执行命令',
  web_fetch: '抓取并读取网页内容',
  get_system_info: '读取运行环境与系统信息',
};

export function ToolsPanel() {
  const allowedTools = useConfigStore((s) => s.allowedTools);
  const toggleTool = useConfigStore((s) => s.toggleTool);

  return (
    <div className="settings-panel-enter space-y-3">
      <div className="rounded-2xl border border-border/60 bg-[linear-gradient(168deg,hsl(var(--secondary)/0.42),hsl(var(--background)/0.36))] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground/95">工具自动执行</p>
          </div>
          <span className="rounded-full border border-border/60 bg-background/45 px-3 py-1 text-xs text-muted-foreground">已启用 {allowedTools.length}/{ALL_TOOLS.length}</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">启用后，该工具会默认自动执行。建议仅开启你信任的能力，修改后点击"保存设置"持久化。</p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {ALL_TOOLS.map((tool) => {
          const enabled = allowedTools.includes(tool.name);
          return (
            <button key={tool.name} type="button" onClick={() => toggleTool(tool.name)} aria-pressed={enabled}
              className={cn('group w-full rounded-xl border px-3 py-3 text-left transition-all duration-200', enabled ? 'border-primary/38 bg-[linear-gradient(140deg,hsl(var(--primary)/0.2),hsl(var(--cool-accent)/0.1))] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)]' : 'border-border/55 bg-secondary/30 hover:border-border/80 hover:bg-secondary/52')}
            >
              <div className="flex items-start gap-3">
                <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', enabled ? 'border-primary/45 bg-primary/18 text-primary' : 'border-border/60 bg-background/35 text-muted-foreground')}>
                  {enabled ? <Check className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground/92">{tool.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground/80">{TOOL_DESCRIPTIONS[tool.name]}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
