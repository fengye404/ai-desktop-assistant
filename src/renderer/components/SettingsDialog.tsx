import { Settings2, Check, AlertCircle, Zap, Wrench } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import type { Provider } from '../../types';
import { useConfigStore, ALL_TOOLS } from '@/stores/config-store';
import { cn } from '@/lib/utils';

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

export function SettingsDialog() {
  const {
    isSettingsOpen,
    setSettingsOpen,
    provider,
    setProvider,
    model,
    setModel,
    apiKey,
    setApiKey,
    baseURL,
    setBaseURL,
    allowedTools,
    toggleTool,
    connectionStatus,
    saveConfig,
    testConnection,
  } = useConfigStore();

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="sm:max-w-[520px] border-border/70 bg-[linear-gradient(165deg,hsl(var(--card)/0.98),hsl(223_18%_8%/0.96))]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl border border-border/60 bg-[linear-gradient(145deg,hsl(var(--primary)/0.25),hsl(var(--cool-accent)/0.2))] flex items-center justify-center">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>设置</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">配置模型、连接和工具权限</p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[60vh]">
          {/* Provider */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/90">AI 提供商</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
              className="w-full h-10 rounded-lg border border-border/60 bg-secondary/45 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI / 兼容 API</option>
            </select>
          </div>

          {/* Model */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/90">模型</label>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={
                provider === 'anthropic'
                  ? '例如: claude-sonnet-4-20250514'
                  : '例如: gpt-4o, deepseek-chat'
              }
            />
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/90">API Key</label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入你的 API Key"
            />
          </div>

          {/* Base URL (for OpenAI compatible) */}
          {provider === 'openai' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/90">
                Base URL <span className="text-muted-foreground font-normal">(可选)</span>
              </label>
              <Input
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
                placeholder="例如: https://api.deepseek.com/v1"
              />
            </div>
          )}

          {/* Connection Status */}
          <div className={cn(
            'flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm border',
            connectionStatus.connected
              ? 'bg-green-500/10 border-green-500/20'
              : 'bg-yellow-500/10 border-yellow-500/20'
          )}>
            {connectionStatus.connected ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            )}
            <span className={cn(
              'font-medium',
              connectionStatus.connected ? 'text-green-500' : 'text-yellow-500'
            )}>
              {connectionStatus.message}
            </span>
          </div>

          {/* Tool Permissions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium text-foreground/90">工具自动执行</label>
              </div>
              <span className="rounded-full border border-border/55 bg-secondary/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                已启用 {allowedTools.length}/{ALL_TOOLS.length}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              启用后，该工具在默认情况下会自动执行，无需逐次确认
            </p>
            <div className="space-y-2">
              {ALL_TOOLS.map((tool) => {
                const enabled = allowedTools.includes(tool.name);
                return (
                  <button
                    key={tool.name}
                    type="button"
                    onClick={() => toggleTool(tool.name)}
                    aria-pressed={enabled}
                    className={cn(
                      'group w-full rounded-xl border px-3 py-2.5 text-left transition-all duration-200',
                      enabled
                        ? 'border-primary/32 bg-primary/10 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)]'
                        : 'border-border/55 bg-secondary/30 hover:border-border/75 hover:bg-secondary/55'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                          enabled
                            ? 'border-primary/45 bg-primary/18 text-primary'
                            : 'border-border/60 bg-background/35 text-muted-foreground'
                        )}
                      >
                        {enabled ? <Check className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground/92">{tool.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground/80">
                          {TOOL_DESCRIPTIONS[tool.name]}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'relative mt-1 inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors',
                          enabled
                            ? 'border-primary/40 bg-primary/65'
                            : 'border-border/70 bg-secondary/80'
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                            enabled ? 'translate-x-[1.05rem]' : 'translate-x-0.5'
                          )}
                        />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={testConnection}
            className="gap-2 border-border/60 bg-secondary/45 hover:bg-secondary/75"
          >
            <Zap className="h-4 w-4" />
            测试连接
          </Button>
          <Button onClick={saveConfig} className="bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--cool-accent)))] text-black/85 hover:opacity-90">
            保存设置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
