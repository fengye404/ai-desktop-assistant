import { useCallback, useEffect, useMemo, useState } from 'react';
import { Server, RefreshCw, Plus, Trash2, PlugZap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { electronApiClient } from '@/services/electron-api-client';
import type { McpServerStatus, McpServerTransport, McpToolInfo } from '../../../types';

function renderServerTarget(server: McpServerStatus): string {
  if (server.transport === 'stdio') {
    const cmd = server.command?.trim() || '(no command)';
    const args = (server.args ?? []).join(' ').trim();
    return args ? `${cmd} ${args}` : cmd;
  }
  return server.url || '(no url)';
}

function parseHeadersInput(raw: string): { headers: Record<string, string>; error?: string } {
  const lines = raw.split(/\r?\n/);
  const headers: Record<string, string> = {};
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]?.trim();
    if (!line) continue;
    const sep = line.indexOf(':');
    if (sep <= 0) return { headers: {}, error: `Header 第 ${i + 1} 行格式错误，请使用 "Key: Value"` };
    const key = line.slice(0, sep).trim();
    if (!key) return { headers: {}, error: `Header 第 ${i + 1} 行缺少 key` };
    headers[key] = line.slice(sep + 1).trim();
  }
  return { headers };
}

interface McpPanelProps {
  subMenu: 'servers' | 'loadedTools';
  isVisible: boolean;
}

export function McpPanel({ subMenu, isVisible }: McpPanelProps) {
  const [servers, setServers] = useState<McpServerStatus[]>([]);
  const [tools, setTools] = useState<McpToolInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [transport, setTransport] = useState<McpServerTransport>('stdio');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [url, setUrl] = useState('');
  const [headersText, setHeadersText] = useState('');

  const loadSnapshot = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([electronApiClient.mcpListServers(), electronApiClient.mcpListTools()]);
      setServers(s); setTools(t); setMessage('');
    } catch (error) {
      setMessage(`读取 MCP 配置失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }, []);

  useEffect(() => { if (isVisible) void loadSnapshot(); }, [isVisible, loadSnapshot]);

  const handleRefresh = useCallback(async () => {
    setBusy(true);
    try {
      const result = await electronApiClient.mcpRefresh();
      setServers(result.servers); setTools(result.tools);
      const cc = result.servers.filter((s) => s.connected).length;
      const ec = result.servers.filter((s) => s.enabled).length;
      setMessage(`刷新完成：已连接 ${cc}/${ec}，工具 ${result.tools.length} 个`);
    } catch (error) {
      setMessage(`刷新失败：${error instanceof Error ? error.message : String(error)}`);
    } finally { setBusy(false); }
  }, []);

  const handleSave = useCallback(async () => {
    const sn = name.trim();
    if (!sn) { setMessage('请输入 MCP 服务器名称'); return; }
    const { headers, error } = parseHeadersInput(headersText);
    if (error) { setMessage(error); return; }

    const config = transport === 'stdio'
      ? { transport: 'stdio' as const, command: command.trim(), args: args.split(/\s+/).filter(Boolean), enabled: true }
      : { transport, url: url.trim(), headers, enabled: true };

    if (config.transport === 'stdio' && !config.command) { setMessage('stdio 模式需要填写 command'); return; }
    if (config.transport !== 'stdio' && !config.url) { setMessage('URL 模式需要填写 url'); return; }

    setBusy(true);
    try {
      const result = await electronApiClient.mcpUpsertServer(sn, config);
      setServers(result.servers); setTools(result.tools);
      setMessage(`MCP 服务器 ${sn} 已保存`);
      setName(''); setCommand(''); setArgs(''); setUrl(''); setHeadersText('');
    } catch (error) {
      setMessage(`保存失败：${error instanceof Error ? error.message : String(error)}`);
    } finally { setBusy(false); }
  }, [name, transport, command, args, url, headersText]);

  const handleRemove = useCallback(async (n: string) => {
    setBusy(true);
    try {
      const result = await electronApiClient.mcpRemoveServer(n);
      setServers(result.servers); setTools(result.tools);
      setMessage(`MCP 服务器 ${n} 已移除`);
    } catch (error) {
      setMessage(`移除失败：${error instanceof Error ? error.message : String(error)}`);
    } finally { setBusy(false); }
  }, []);

  const enabled = useMemo(() => servers.filter((s) => s.enabled).length, [servers]);
  const connected = useMemo(() => servers.filter((s) => s.connected).length, [servers]);
  const msgIsError = /失败|错误/.test(message);

  const fieldClassName = 'border-border/70 bg-[hsl(var(--background)/0.55)] placeholder:text-muted-foreground/70 focus-visible:border-primary/55 focus-visible:ring-primary/35';
  const selectClassName = 'h-10 w-full rounded-lg border border-border/70 bg-[hsl(var(--background)/0.55)] px-3.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/35 focus:border-primary/55';

  return (
    <>
      {subMenu === 'servers' && (
        <div className="settings-panel-enter space-y-3">
          <div className="rounded-2xl border border-border/60 bg-[linear-gradient(168deg,hsl(var(--secondary)/0.45),hsl(var(--background)/0.38))] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2"><Server className="h-4 w-4 text-muted-foreground" /><p className="text-sm font-semibold text-foreground/95">服务器列表</p></div>
              <Button size="sm" variant="outline" disabled={busy} onClick={handleRefresh} className="gap-1.5 border-border/65 bg-background/40 hover:bg-secondary/65"><RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} />刷新</Button>
            </div>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-background/35 px-3 py-2.5"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">已启用</p><p className="mt-1 text-sm font-semibold text-foreground/92">{enabled}</p></div>
              <div className="rounded-xl border border-border/60 bg-background/35 px-3 py-2.5"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">已连接</p><p className="mt-1 text-sm font-semibold text-foreground/92">{connected}</p></div>
              <div className="rounded-xl border border-border/60 bg-background/35 px-3 py-2.5"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">工具数</p><p className="mt-1 text-sm font-semibold text-foreground/92">{tools.length}</p></div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-secondary/24 p-4">
            <p className="text-sm font-semibold text-foreground/95">添加或更新 MCP 服务器</p>
            <p className="mt-1 text-xs text-muted-foreground">支持 `stdio`、`streamable-http` 和 `sse`。</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><label htmlFor="mcp-name" className="text-xs font-medium text-foreground/90">名称</label><Input id="mcp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 filesystem" className={fieldClassName} /></div>
              <div className="space-y-2"><label htmlFor="mcp-transport" className="text-xs font-medium text-foreground/90">传输协议</label><select id="mcp-transport" value={transport} onChange={(e) => setTransport(e.target.value as McpServerTransport)} className={selectClassName}><option value="stdio">stdio</option><option value="streamable-http">streamable-http</option><option value="sse">sse</option></select></div>
              {transport === 'stdio' ? (
                <>
                  <div className="space-y-2 sm:col-span-2"><label htmlFor="mcp-command" className="text-xs font-medium text-foreground/90">Command</label><Input id="mcp-command" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="例如 npx" className={fieldClassName} /></div>
                  <div className="space-y-2 sm:col-span-2"><label htmlFor="mcp-args" className="text-xs font-medium text-foreground/90">Args</label><Input id="mcp-args" value={args} onChange={(e) => setArgs(e.target.value)} placeholder="空格分隔，例如 -y @anthropic/mcp-server-filesystem ./" className={fieldClassName} /></div>
                </>
              ) : (
                <>
                  <div className="space-y-2 sm:col-span-2"><label htmlFor="mcp-url" className="text-xs font-medium text-foreground/90">URL</label><Input id="mcp-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="例如 https://mcp.notion.com/mcp" className={fieldClassName} /></div>
                  <div className="space-y-2 sm:col-span-2"><label htmlFor="mcp-headers" className="text-xs font-medium text-foreground/90">Headers（可选）</label><Textarea id="mcp-headers" value={headersText} onChange={(e) => setHeadersText(e.target.value)} placeholder={'每行一个，例如\nAuthorization: Bearer <token>\nX-API-Key: <key>'} className={cn('min-h-[92px]', fieldClassName)} /></div>
                </>
              )}
            </div>
            <Button size="sm" disabled={busy} onClick={handleSave} className="mt-4 gap-1.5 text-primary-foreground shadow-primary/20"><Plus className="h-3.5 w-3.5" />保存 MCP 服务器</Button>
          </div>

          {message && <div className={cn('rounded-xl border px-3 py-2 text-xs', msgIsError ? 'border-destructive/35 bg-destructive/12 text-destructive' : 'border-border/60 bg-secondary/35 text-muted-foreground')}>{message}</div>}

          <div className="space-y-2.5">
            {servers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/55 bg-secondary/20 px-3 py-3 text-xs text-muted-foreground">还没有 MCP 服务器配置。可先添加一个 `stdio` 或 URL 类型服务。</div>
            ) : (
              servers.map((server) => {
                const tone = !server.enabled ? 'text-muted-foreground' : server.connected ? 'text-[hsl(var(--cool-accent))]' : 'text-primary';
                return (
                  <div key={server.name} className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2"><PlugZap className={cn('h-3.5 w-3.5', tone)} /><p className="truncate text-sm font-semibold text-foreground/92">{server.name}</p><span className="rounded-full border border-border/55 bg-background/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{server.transport}</span></div>
                        <p className="mt-1 break-all text-xs text-muted-foreground">{renderServerTarget(server)}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground/85">状态: {server.enabled ? (server.connected ? '已连接' : '未连接') : '已禁用'} · 工具: {server.toolCount}</p>
                        {server.lastError && <p className="mt-1 break-all text-[11px] text-destructive/90">{server.lastError}</p>}
                      </div>
                      <Button variant="ghost" size="icon" disabled={busy} onClick={() => handleRemove(server.name)} className="h-8 w-8 text-muted-foreground hover:bg-destructive/20 hover:text-destructive-foreground" title="删除服务器"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {subMenu === 'loadedTools' && (
        <div className="settings-panel-enter space-y-3">
          <div className="rounded-2xl border border-border/60 bg-[linear-gradient(168deg,hsl(var(--secondary)/0.42),hsl(var(--background)/0.36))] p-4">
            <p className="text-sm font-semibold text-foreground/95">已加载工具</p>
            <p className="mt-1 text-xs text-muted-foreground">当前 MCP 服务器暴露给模型调用的工具清单。</p>
          </div>
          {tools.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/55 bg-secondary/20 px-3 py-3 text-xs text-muted-foreground">还没有已加载工具。请先在"服务器管理"里添加并刷新 MCP 服务器。</div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {tools.map((tool) => (
                <div key={tool.alias} className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-3">
                  <p className="break-all text-sm font-semibold text-foreground/92"><code>{tool.alias}</code></p>
                  <p className="mt-1 text-[11px] text-muted-foreground">来源: {tool.server}.{tool.originalName}</p>
                  {tool.description && <p className="mt-1 break-words text-[11px] text-muted-foreground/85">{tool.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
