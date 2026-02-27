import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useConfigStore } from '@/stores/config-store';

export function ModelSelector() {
  const providers = useConfigStore((s) => s.providers);
  const activeProviderId = useConfigStore((s) => s.activeProviderId);
  const activeModelId = useConfigStore((s) => s.activeModelId);
  const setActiveModel = useConfigStore((s) => s.setActiveModel);
  const saveConfig = useConfigStore((s) => s.saveConfig);
  const setSettingsOpen = useConfigStore((s) => s.setSettingsOpen);

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = 'chat-model-selector-menu';

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleSelectModel = useCallback(async (providerId: string, modelId: string) => {
    setActiveModel(providerId, modelId);
    setIsOpen(false);
    await saveConfig();
  }, [setActiveModel, saveConfig]);

  const currentModelLabel = useMemo(() => {
    if (!activeModelId) return '选择模型';
    const parts = activeModelId.split('/');
    return parts[parts.length - 1] || activeModelId;
  }, [activeModelId]);

  const activeProvider = useMemo(() => {
    return providers.find((p) => p.id === activeProviderId) ?? null;
  }, [providers, activeProviderId]);

  const activeProviderName = activeProvider?.name?.trim() || '未配置供应商';
  const activeProtocolLabel = activeProvider?.protocol.toUpperCase() || 'N/A';
  const hasModelOptions = providers.some((p) => p.models.length > 0);

  const handleOpenSettings = useCallback(() => {
    setIsOpen(false);
    setSettingsOpen(true);
  }, [setSettingsOpen]);

  return (
    <div className="relative no-drag" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={menuId}
        className={[
          'group flex min-h-[38px] min-w-[190px] max-w-[280px] items-center gap-2.5 rounded-xl border px-3 py-1.5 text-left transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-0',
          isOpen
            ? 'border-[hsl(var(--cool-accent)/0.65)] bg-[linear-gradient(140deg,hsl(var(--secondary)/0.92),hsl(var(--secondary)/0.78))] shadow-[0_10px_24px_hsl(var(--background)/0.45)]'
            : 'border-border/55 bg-[linear-gradient(140deg,hsl(var(--secondary)/0.52),hsl(var(--secondary)/0.36))] hover:border-border/80 hover:bg-secondary/70',
        ].join(' ')}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] leading-none text-muted-foreground/90">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--cool-accent))] shadow-[0_0_0_3px_hsl(var(--cool-accent)/0.2)]" />
            <span className="truncate">{activeProviderName}</span>
          </div>
          <div className="mt-0.5 truncate text-[13px] font-semibold leading-tight text-foreground/95">
            {currentModelLabel}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-md border border-border/70 bg-background/45 px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-[0.09em] leading-none text-muted-foreground/85">
            {activeProtocolLabel}
          </span>
          <ChevronDown className={[
            'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
            isOpen ? 'rotate-180 text-foreground/90' : 'rotate-0',
          ].join(' ')} />
        </div>
      </button>

      {isOpen && (
        <div id={menuId} role="listbox" className="model-selector-panel absolute right-0 top-full mt-2 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border/75 bg-[linear-gradient(160deg,hsl(var(--secondary)/0.97),hsl(222_18%_11%/0.97))] shadow-[0_20px_38px_hsl(var(--background)/0.6)] z-[100]">
          <div className="border-b border-border/65 bg-background/30 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/85">模型选择器</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-foreground/95">{activeProviderName}</p>
              <span className="rounded-md border border-border/70 bg-secondary/65 px-2 py-0.5 text-[11px] font-medium text-muted-foreground/90">
                {activeModelId ? `当前: ${currentModelLabel}` : '未选择模型'}
              </span>
            </div>
          </div>

          {providers.length === 0 || !hasModelOptions ? (
            <div className="px-4 py-5">
              <p className="text-sm font-medium text-foreground/90">还没有可用模型</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground/80">先在设置中添加供应商并填写模型 ID，然后就可以在这里快速切换。</p>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onClick={handleOpenSettings} className="mt-3 inline-flex h-8 items-center justify-center rounded-lg border border-border/70 bg-secondary/70 px-3 text-xs font-medium text-foreground/90 transition-colors hover:bg-secondary/90">打开设置</button>
            </div>
          ) : (
            <div className="max-h-[360px] space-y-2 overflow-y-auto p-2">
              {providers.map((provider) => (
                <section key={provider.id} className="rounded-xl border border-border/65 bg-[linear-gradient(160deg,hsl(var(--secondary)/0.58),hsl(var(--secondary)/0.4))] p-1.5">
                  <div className="mb-1 flex items-center justify-between gap-2 px-1.5 py-1">
                    <p className="truncate text-[11px] uppercase tracking-[0.12em] text-muted-foreground/90">{provider.name || '未命名供应商'}</p>
                    <span className="rounded-md border border-border/70 bg-background/40 px-1.5 py-0.5 text-[10px] text-muted-foreground/80">{provider.models.length} 个模型</span>
                  </div>
                  {provider.models.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground/65">暂无模型</div>
                  ) : (
                    <div className="space-y-1">
                      {provider.models.map((modelId) => {
                        const isActive = provider.id === activeProviderId && modelId === activeModelId;
                        const segments = modelId.split('/');
                        const modelShortName = segments[segments.length - 1] || modelId;
                        return (
                          <button key={`${provider.id}-${modelId}`} type="button" role="option" aria-selected={isActive}
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onClick={() => { void handleSelectModel(provider.id, modelId); }}
                            className={[
                              'flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-all duration-150',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-0',
                              isActive
                                ? 'border-[hsl(var(--cool-accent)/0.55)] bg-[linear-gradient(130deg,hsl(var(--cool-accent)/0.22),hsl(var(--secondary)/0.92))] text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)]'
                                : 'border-transparent bg-transparent text-foreground/88 hover:border-border/75 hover:bg-secondary/65',
                            ].join(' ')}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-medium">{modelShortName}</p>
                              {modelShortName !== modelId && <p className="truncate text-[11px] text-muted-foreground/75">{modelId}</p>}
                            </div>
                            {isActive && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--cool-accent)/0.45)] bg-[hsl(var(--cool-accent)/0.16)] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--cool-accent))]">
                                <Check className="h-3 w-3 shrink-0" />当前
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
          <div className="border-t border-border/65 bg-background/25 px-3 py-2 text-[11px] text-muted-foreground/75">在设置中可管理供应商、模型列表与 API 凭证。</div>
        </div>
      )}
    </div>
  );
}
