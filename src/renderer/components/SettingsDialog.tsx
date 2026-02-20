import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useConfigStore, Provider } from '@/stores/config-store';

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
    connectionStatus,
    saveConfig,
    testConnection,
  } = useConfigStore();

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Provider */}
          <div className="space-y-2">
            <label className="text-sm font-medium">AI 提供商</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI / 兼容 API</option>
            </select>
          </div>

          {/* Model */}
          <div className="space-y-2">
            <label className="text-sm font-medium">模型</label>
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
            <label className="text-sm font-medium">API Key</label>
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
              <label className="text-sm font-medium">Base URL (可选)</label>
              <Input
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
                placeholder="例如: https://api.deepseek.com/v1"
              />
            </div>
          )}

          {/* Connection Status */}
          <div className="flex items-center gap-2 text-sm">
            <div
              className={`w-2 h-2 rounded-full ${
                connectionStatus.connected ? 'bg-green-500' : 'bg-yellow-500'
              }`}
            />
            <span className="text-muted-foreground">{connectionStatus.message}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={testConnection}>
            测试连接
          </Button>
          <Button onClick={saveConfig}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
