import { useRef, useState, useEffect, useCallback } from 'react';
import { Send, Square, ImagePlus, TerminalSquare, FolderOpen, FileCode2, X } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { useComposerAutocomplete, renderHighlightedLabel } from '@/hooks/useComposerAutocomplete';
import { useImageAttachments } from '@/hooks/useImageAttachments';
import { useInputHistory } from '@/hooks/useInputHistory';
import { extractAutocompleteTarget } from '@/lib/composer-autocomplete';
import { parseSlashCommand } from '@/lib/slash-commands';
import type { ChatImageAttachment } from '../../types';

const DOUBLE_ESCAPE_INTERVAL_MS = 450;

interface ComposerAreaProps {
  isLoading: boolean;
  apiKey: string;
  onSend: (message: string, attachments?: ChatImageAttachment[]) => Promise<void>;
  onCancel: () => Promise<void>;
  onOpenSettings: () => void;
  onOpenRecoveryMenu: () => void;
  composerHint: string;
  setComposerHint: (hint: string) => void;
  onResetThinking: () => void;
}

export function ComposerArea({
  isLoading,
  apiKey,
  onSend,
  onCancel,
  onOpenSettings,
  onOpenRecoveryMenu,
  composerHint,
  setComposerHint,
  onResetThinking,
}: ComposerAreaProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef(input);
  const lastEscapePressedAtRef = useRef<number>(0);

  useEffect(() => { inputRef.current = input; }, [input]);

  useEffect(() => {
    if (!composerHint) return;
    const timer = window.setTimeout(() => setComposerHint(''), 4200);
    return () => window.clearTimeout(timer);
  }, [composerHint, setComposerHint]);

  const images = useImageAttachments({ onHint: setComposerHint, textareaRef });
  const history = useInputHistory();
  const ac = useComposerAutocomplete({ textareaRef, inputRef });

  useEffect(() => {
    if (!ac.autocomplete) return;
    requestAnimationFrame(() => {
      const active = document.querySelector<HTMLElement>('[data-autocomplete-active="true"]');
      active?.scrollIntoView({ block: 'nearest' });
    });
  }, [ac.autocomplete]);

  const hasComposedContent = input.trim().length > 0 || images.pastedImages.length > 0;

  const applyAutocompleteItem = useCallback((index: number) => {
    const result = ac.apply(index, input);
    if (!result) return false;
    setInput(result.value);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(result.cursor, result.cursor);
      void ac.update(result.value, result.cursor);
    });
    return true;
  }, [ac, input]);

  const handleSend = useCallback(async () => {
    if (isLoading) return;
    const inputMessage = input.trim();
    if (!inputMessage && images.pastedImages.length === 0) return;

    const isSlashCommand = Boolean(parseSlashCommand(inputMessage));
    const attachments = !isSlashCommand && images.pastedImages.length > 0 ? images.pastedImages : undefined;

    if (!isSlashCommand && !apiKey) { onOpenSettings(); return; }
    if (isSlashCommand && images.pastedImages.length > 0) setComposerHint('斜杠命令已执行，粘贴的图片将被忽略。');
    const keepHint = isSlashCommand && images.pastedImages.length > 0;

    if (inputMessage) history.push(inputMessage);
    ac.dismiss();
    setInput('');
    images.setPastedImages([]);
    if (!keepHint) setComposerHint('');
    onResetThinking();
    await onSend(inputMessage, attachments);
  }, [input, images, isLoading, apiKey, onOpenSettings, onSend, setComposerHint, history, ac, onResetThinking]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (ac.autocomplete && ac.autocomplete.items.length > 0) {
      const isNext = e.key === 'ArrowDown' || (e.ctrlKey && (e.key === 'n' || e.key === 'N'));
      const isPrev = e.key === 'ArrowUp' || (e.ctrlKey && (e.key === 'p' || e.key === 'P'));
      if (isNext) { ac.suppressRefreshRef.current = true; e.preventDefault(); ac.setAutocomplete((prev) => prev ? { ...prev, selectedIndex: (prev.selectedIndex + 1) % prev.items.length } : prev); return; }
      if (isPrev) { ac.suppressRefreshRef.current = true; e.preventDefault(); ac.setAutocomplete((prev) => prev ? { ...prev, selectedIndex: (prev.selectedIndex - 1 + prev.items.length) % prev.items.length } : prev); return; }
      if (e.key === 'Escape') { ac.suppressRefreshRef.current = true; e.preventDefault(); ac.setAutocomplete(null); return; }
      if (e.key === 'Tab') { ac.suppressRefreshRef.current = true; e.preventDefault(); applyAutocompleteItem(ac.autocomplete.selectedIndex); return; }
      if (e.key === 'Enter' && !e.shiftKey) { ac.suppressRefreshRef.current = true; e.preventDefault(); applyAutocompleteItem(ac.autocomplete.selectedIndex); return; }
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (e.repeat) return;
      if (isLoading) { void onCancel(); lastEscapePressedAtRef.current = 0; setComposerHint('已停止当前响应。'); return; }
      const now = Date.now();
      if (now - lastEscapePressedAtRef.current <= DOUBLE_ESCAPE_INTERVAL_MS) { lastEscapePressedAtRef.current = 0; onOpenRecoveryMenu(); }
      else { lastEscapePressedAtRef.current = now; setComposerHint('再按一次 Esc 打开恢复菜单。'); }
      return;
    }

    if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key === 'Backspace' && input.length === 0 && images.pastedImages.length > 0) {
      e.preventDefault(); images.removeLastImage(); return;
    }

    const hasModifier = e.metaKey || e.ctrlKey || e.altKey || e.shiftKey;
    if (!hasModifier && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const textarea = textareaRef.current;
      if (textarea) {
        const ss = textarea.selectionStart ?? 0;
        const se = textarea.selectionEnd ?? 0;
        const noSel = ss === se;
        if (e.key === 'ArrowUp' && noSel && ss === 0 && (input.length === 0 || history.isNavigating)) {
          const prev = history.navigate('prev', input);
          if (prev !== null) { e.preventDefault(); setInput(prev); requestAnimationFrame(() => { textareaRef.current?.setSelectionRange(prev.length, prev.length); }); }
          return;
        }
        if (e.key === 'ArrowDown' && noSel && ss === input.length && history.isNavigating) {
          const next = history.navigate('next', input);
          if (next !== null) { e.preventDefault(); setInput(next); requestAnimationFrame(() => { textareaRef.current?.setSelectionRange(next.length, next.length); }); }
          return;
        }
      }
    }

    if (e.key === 'Tab') {
      const textarea = textareaRef.current;
      if (textarea) {
        const value = textarea.value;
        const cursor = textarea.selectionStart ?? value.length;
        if (extractAutocompleteTarget(value, cursor)) { e.preventDefault(); void ac.update(value, cursor); }
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    if (history.isNavigating) history.resetNavigation();
    setInput(nextValue);
    void ac.update(nextValue, e.target.selectionStart ?? nextValue.length);
  };

  const handleCursorChange = () => {
    if (ac.suppressRefreshRef.current) { ac.suppressRefreshRef.current = false; return; }
    ac.refreshFromTextarea();
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (['Tab', 'Enter', 'Escape'].includes(e.key)) return;
    if ((e.ctrlKey && ['n', 'N', 'p', 'P'].includes(e.key)) && ac.autocomplete) return;
    if (['ArrowDown', 'ArrowUp'].includes(e.key) && ac.autocomplete) return;
    ac.refreshFromTextarea();
  };

  return (
    <div className="border-t border-border/55 bg-background/45 p-4 backdrop-blur-xl">
      <div className="max-w-4xl mx-auto">
        <div className="relative">
          {ac.autocomplete && ac.autocomplete.items.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 no-drag rounded-xl border border-border/70 bg-[linear-gradient(160deg,hsl(var(--secondary)/0.96),hsl(222_18%_11%/0.96))] shadow-[0_14px_30px_hsl(var(--background)/0.55)] overflow-hidden z-20">
              <div className="max-h-56 overflow-y-auto p-1.5 space-y-1">
                {ac.autocomplete.items.map((item, index) => {
                  const selected = index === ac.autocomplete!.selectedIndex;
                  const icon = item.kind === 'slash' ? <TerminalSquare className="h-3.5 w-3.5 text-foreground/70" /> : item.isDirectory ? <FolderOpen className="h-3.5 w-3.5 text-[hsl(var(--cool-accent))]" /> : <FileCode2 className="h-3.5 w-3.5 text-primary" />;
                  return (
                    <button key={item.key} type="button" data-autocomplete-active={selected ? 'true' : 'false'} onMouseDown={(ev) => { ev.preventDefault(); applyAutocompleteItem(index); }}
                      className={['w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150', selected ? 'bg-[linear-gradient(125deg,hsl(var(--cool-accent)/0.2),hsl(var(--secondary)/0.84))] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--cool-accent)/0.36),0_6px_12px_hsl(var(--background)/0.28)]' : 'bg-transparent text-foreground/88 hover:bg-secondary/72'].join(' ')}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm break-all flex items-center gap-2">{icon}<span>{renderHighlightedLabel(item.label, ac.autocomplete!.target.query)}</span></span>
                        <span className={['text-[11px] uppercase tracking-[0.08em] shrink-0', selected ? 'text-foreground/85' : 'text-muted-foreground/80'].join(' ')}>{item.description}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="px-3 py-1.5 text-[11px] text-muted-foreground/75 border-t border-border/45 flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="rounded-md border border-border/65 bg-secondary/65 px-1.5 py-0.5 text-[10px] text-foreground/85">Tab</span><span>补全</span>
                  <span className="rounded-md border border-border/65 bg-secondary/65 px-1.5 py-0.5 text-[10px] text-foreground/85">↑ ↓</span><span>选择</span>
                  <span className="rounded-md border border-border/65 bg-secondary/65 px-1.5 py-0.5 text-[10px] text-foreground/85">Enter</span><span>应用</span>
                </span>
                <span className="text-[hsl(var(--cool-accent))]">{ac.autocomplete.selectedIndex + 1}/{ac.autocomplete.items.length}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <input ref={images.imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={images.handlePickerChange} />
            <div className={['relative composer-shell rounded-xl border border-border/60 p-2.5 transition-all', images.isDropActive ? 'border-primary/55 bg-[hsl(var(--primary)/0.08)]' : ''].join(' ')} {...images.dragHandlers}>
              {images.pastedImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 px-0.5">
                  {images.pastedImages.map((img) => (
                    <div key={img.id} className="group relative shrink-0">
                      <img src={img.dataUrl} alt={img.name} title={img.name} className="h-16 w-16 rounded-lg object-cover ring-1 ring-border/50" />
                      <button type="button" onClick={() => images.removeImage(img.id)} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground/80 text-background shadow-sm opacity-0 transition-opacity group-hover:opacity-100" aria-label={`移除 ${img.name}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-3 items-end">
                <Button type="button" variant="ghost" size="icon" onClick={images.openPicker} disabled={images.pastedImages.length >= images.maxImages} title="添加图片" aria-label="添加图片" className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground hover:text-foreground disabled:opacity-35">
                  <ImagePlus className="h-4 w-4" />
                </Button>
                <Textarea ref={textareaRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown} onClick={handleCursorChange} onKeyUp={handleKeyUp} onSelect={handleCursorChange} onPaste={images.handlePaste} onBlur={() => ac.setAutocomplete(null)} placeholder="输入消息… (Enter 发送，Ctrl+V/拖拽/按钮添加图片)" className="flex-1 min-h-[40px] max-h-[200px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-[0.95rem] placeholder:text-muted-foreground/60" rows={1} />
                {isLoading ? (
                  <Button variant="destructive" size="icon" onClick={() => { void onCancel(); }} aria-label="停止生成" className="h-10 w-10 rounded-xl shrink-0"><Square className="h-4 w-4" /></Button>
                ) : (
                  <Button size="icon" onClick={() => { void handleSend(); }} disabled={!hasComposedContent} aria-label="发送消息" className="h-10 w-10 rounded-xl shrink-0 text-primary-foreground shadow-primary/20 disabled:opacity-30"><Send className="h-4 w-4" /></Button>
                )}
              </div>
              {images.isDropActive && (
                <div className="pointer-events-none absolute inset-0 rounded-xl border border-primary/50 bg-[hsl(var(--background)/0.7)] backdrop-blur-sm flex items-center justify-center">
                  <div className="flex items-center gap-2 text-sm text-primary"><ImagePlus className="h-4 w-4" />松开以添加图片附件</div>
                </div>
              )}
            </div>
            {composerHint && <p className="text-[11px] text-[hsl(var(--cool-accent))]">{composerHint}</p>}
          </div>
        </div>
        <p className="text-center text-[11px] text-muted-foreground/65 mt-2 tracking-[0.04em]">Shift+Enter 换行 · Esc 停止生成 · Esc+Esc 恢复菜单 · Ctrl+V/拖拽/按钮添加图片 · Backspace 可删除最后一张附件 · 结果可能有误，请核实关键操作</p>
      </div>
    </div>
  );
}
