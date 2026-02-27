import { useCallback, useMemo, useState } from 'react';
import {
  Check, AlertCircle, Plus, Trash2, X, ChevronDown, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ModelProvider, Provider } from '../../../types';
import { useConfigStore } from '@/stores/config-store';

function createProviderId(): string {
  return `provider_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function ProviderCard({
  provider,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onRemove,
  onAddModel,
  onRemoveModel,
}: {
  provider: ModelProvider;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<Omit<ModelProvider, 'id'>>) => void;
  onRemove: () => void;
  onAddModel: (modelId: string) => void;
  onRemoveModel: (modelId: string) => void;
}) {
  const [newModelId, setNewModelId] = useState('');
  const fieldClassName =
    'border-border/70 bg-[hsl(var(--background)/0.55)] placeholder:text-muted-foreground/70 focus-visible:border-primary/55 focus-visible:ring-primary/35';
  const selectClassName =
    'h-9 w-full rounded-lg border border-border/70 bg-[hsl(var(--background)/0.55)] px-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/35 focus:border-primary/55';

  const handleAddModel = () => {
    const trimmed = newModelId.trim();
    if (!trimmed) return;
    onAddModel(trimmed);
    setNewModelId('');
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-[linear-gradient(165deg,hsl(var(--secondary)/0.35),hsl(var(--background)/0.4))] overflow-hidden">
      <button type="button" onClick={onToggleExpand} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-secondary/30 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground/95 truncate">{provider.name}</p>
            {provider.description && <p className="text-[11px] text-muted-foreground truncate">{provider.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-full border border-border/55 bg-background/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{provider.protocol === 'anthropic' ? 'Anthropic' : 'OpenAI'}</span>
          <span className="rounded-full border border-border/55 bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground">{provider.models.length} 个模型</span>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border/50 px-4 py-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/90">名称</label>
              <Input value={provider.name} onChange={(e) => onUpdate({ name: e.target.value })} placeholder="例如: 硅基流动" className={cn('h-9', fieldClassName)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/90">协议类型</label>
              <select value={provider.protocol} onChange={(e) => onUpdate({ protocol: e.target.value as Provider })} className={selectClassName}>
                <option value="openai">OpenAI 规范</option>
                <option value="anthropic">Anthropic 规范</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/90">描述 <span className="font-normal text-muted-foreground">(可选)</span></label>
            <Input value={provider.description} onChange={(e) => onUpdate({ description: e.target.value })} placeholder="简短描述此供应商" className={cn('h-9', fieldClassName)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/90">Base URL</label>
            <Input value={provider.baseURL || ''} onChange={(e) => onUpdate({ baseURL: e.target.value || undefined })} placeholder="例如: https://api.siliconflow.cn/v1/chat/completions" className={cn('h-9', fieldClassName)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/90">API Key</label>
            <Input type="password" value={provider.apiKey} onChange={(e) => onUpdate({ apiKey: e.target.value })} placeholder="输入你的 API Key" className={cn('h-9', fieldClassName)} />
            <p className="text-[11px] text-muted-foreground">密钥仅保存在本机，使用系统安全存储加密。</p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground/90">模型列表</label>
            {provider.models.length > 0 && (
              <div className="space-y-1.5">
                {provider.models.map((modelId) => (
                  <div key={modelId} className="flex items-center justify-between rounded-lg border border-border/55 bg-background/35 px-3 py-2">
                    <code className="text-sm text-foreground/90">{modelId}</code>
                    <button type="button" onClick={() => onRemoveModel(modelId)} className="text-muted-foreground hover:text-destructive transition-colors" title="移除模型"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input value={newModelId} onChange={(e) => setNewModelId(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddModel(); } }} placeholder="输入模型 ID，例如: deepseek-ai/DeepSeek-R1" className={cn('h-9 flex-1', fieldClassName)} />
              <Button type="button" variant="outline" size="sm" onClick={handleAddModel} disabled={!newModelId.trim()} className="h-9 gap-1 border-border/65 bg-background/40 hover:bg-secondary/65 shrink-0"><Plus className="h-3.5 w-3.5" />添加</Button>
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="gap-1.5 text-destructive/80 hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" />删除此供应商</Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ProvidersPanelProps {
  subMenu: 'providers' | 'connection';
}

export function ProvidersPanel({ subMenu }: ProvidersPanelProps) {
  const providers = useConfigStore((s) => s.providers);
  const activeProviderId = useConfigStore((s) => s.activeProviderId);
  const activeModelId = useConfigStore((s) => s.activeModelId);
  const model = useConfigStore((s) => s.model);
  const apiKey = useConfigStore((s) => s.apiKey);
  const connectionStatus = useConfigStore((s) => s.connectionStatus);
  const addProvider = useConfigStore((s) => s.addProvider);
  const updateProvider = useConfigStore((s) => s.updateProvider);
  const removeProvider = useConfigStore((s) => s.removeProvider);
  const addModelToProvider = useConfigStore((s) => s.addModelToProvider);
  const removeModelFromProvider = useConfigStore((s) => s.removeModelFromProvider);

  const [expandedProviderId, setExpandedProviderId] = useState<string | null>(null);

  const handleAddProvider = useCallback(() => {
    const newProvider: ModelProvider = { id: createProviderId(), name: '', description: '', protocol: 'openai', apiKey: '', models: [] };
    addProvider(newProvider);
    setExpandedProviderId(newProvider.id);
  }, [addProvider]);

  const hasModelCredentials = Boolean(model.trim() && apiKey.trim());

  const activeProviderName = useMemo(() => {
    const p = providers.find((item) => item.id === activeProviderId);
    return p?.name || '未选择';
  }, [providers, activeProviderId]);

  return (
    <>
      <div aria-hidden={subMenu !== 'providers'} className={cn('settings-panel-enter', subMenu === 'providers' ? 'block' : 'hidden')}>
        <div className="space-y-3">
          <div className="rounded-2xl border border-border/60 bg-[linear-gradient(165deg,hsl(var(--secondary)/0.4),hsl(var(--background)/0.42))] p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground/95">模型供应商管理</p>
                <p className="mt-1 text-xs text-muted-foreground">添加模型供应商，配置协议类型和 API 凭证，然后在供应商下添加模型。</p>
              </div>
              <span className="rounded-full border border-border/65 bg-background/50 px-3 py-1 text-xs text-muted-foreground">{providers.length} 个供应商</span>
            </div>
          </div>

          {providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              isExpanded={expandedProviderId === provider.id}
              onToggleExpand={() => setExpandedProviderId(expandedProviderId === provider.id ? null : provider.id)}
              onUpdate={(patch) => updateProvider(provider.id, patch)}
              onRemove={() => { removeProvider(provider.id); if (expandedProviderId === provider.id) setExpandedProviderId(null); }}
              onAddModel={(modelId) => addModelToProvider(provider.id, modelId)}
              onRemoveModel={(modelId) => removeModelFromProvider(provider.id, modelId)}
            />
          ))}

          <button type="button" onClick={handleAddProvider} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/55 bg-secondary/15 px-4 py-4 text-sm text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/8 hover:text-foreground">
            <Plus className="h-4 w-4" />添加模型供应商
          </button>
        </div>
      </div>

      <div aria-hidden={subMenu !== 'connection'} className={cn('settings-panel-enter space-y-3', subMenu === 'connection' ? 'block' : 'hidden')}>
        <div className={cn('rounded-2xl border px-4 py-4 sm:p-5', connectionStatus.connected ? 'border-[hsl(var(--cool-accent)/0.42)] bg-[hsl(var(--cool-accent)/0.1)]' : 'border-primary/35 bg-primary/10')}>
          <div className="flex items-start gap-3">
            <div className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', connectionStatus.connected ? 'border-[hsl(var(--cool-accent)/0.45)] bg-[hsl(var(--cool-accent)/0.2)] text-[hsl(var(--cool-accent))]' : 'border-primary/45 bg-primary/18 text-primary')}>
              {connectionStatus.connected ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground/95">连接诊断</p>
              <p className={cn('mt-1 text-sm font-medium break-words', connectionStatus.connected ? 'text-[hsl(var(--cool-accent))]' : 'text-primary')}>{connectionStatus.message}</p>
              <p className="mt-2 text-xs text-muted-foreground">先保存模型配置，再执行"测试连接"，结果会更准确。</p>
            </div>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-secondary/25 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">当前供应商</p>
            <p className="mt-1 text-sm font-medium text-foreground/92">{activeProviderName}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-secondary/25 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">配置完整度</p>
            <p className={cn('mt-1 text-sm font-medium', hasModelCredentials ? 'text-[hsl(var(--cool-accent))]' : 'text-primary')}>{hasModelCredentials ? '模型与凭证已填写' : '缺少模型或 API Key'}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/25 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">当前模型</p>
          <p className="mt-1 text-sm font-medium text-foreground/92">{activeModelId || '未选择'}</p>
        </div>
      </div>
    </>
  );
}
