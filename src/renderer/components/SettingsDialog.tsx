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
import { useConfigStore, Provider, ALL_TOOLS } from '@/stores/config-store';
import { cn } from '@/lib/utils';

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
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>设置</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">配置 AI 服务连接</p>
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
              className="w-full h-10 rounded-lg border border-border/50 bg-secondary/50 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
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
            "flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm border",
            connectionStatus.connected 
              ? "bg-green-500/10 border-green-500/20" 
              : "bg-yellow-500/10 border-yellow-500/20"
          )}>
            {connectionStatus.connected ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            )}
            <span className={cn(
              "font-medium",
              connectionStatus.connected ? "text-green-500" : "text-yellow-500"
            )}>
              {connectionStatus.message}
            </span>
          </div>

          {/* Tool Permissions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-medium text-foreground/90">工具自动执行</label>
            </div>
            <p className="text-xs text-muted-foreground">
              勾选的工具将自动执行，无需每次确认
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_TOOLS.map((tool) => (
                <label
                  key={tool.name}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all",
                    allowedTools.includes(tool.name)
                      ? "bg-primary/10 border-primary/30"
                      : "bg-secondary/30 border-border/50 hover:bg-secondary/50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={allowedTools.includes(tool.name)}
                    onChange={() => toggleTool(tool.name)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                  />
                  <span className="text-sm">{tool.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={testConnection}
            className="gap-2"
          >
            <Zap className="h-4 w-4" />
            测试连接
          </Button>
          <Button onClick={saveConfig}>
            保存设置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
