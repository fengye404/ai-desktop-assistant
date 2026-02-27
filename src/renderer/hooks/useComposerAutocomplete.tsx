import { useState, useRef, useCallback } from 'react';
import { electronApiClient } from '@/services/electron-api-client';
import {
  applyAutocompleteReplacement,
  extractAutocompleteTarget,
  type ComposerAutocompleteTarget,
} from '@/lib/composer-autocomplete';
import { getSlashCommandSuggestions } from '@/lib/slash-commands';

export interface ComposerAutocompleteItem {
  key: string;
  kind: 'slash' | 'path';
  insertValue: string;
  label: string;
  description: string;
  appendTrailingSpace: boolean;
  isDirectory?: boolean;
}

export interface ComposerAutocompleteState {
  target: ComposerAutocompleteTarget;
  items: ComposerAutocompleteItem[];
  selectedIndex: number;
}

function pickSelectedIndex(
  prev: ComposerAutocompleteState | null,
  target: ComposerAutocompleteTarget,
  nextItems: ComposerAutocompleteItem[],
): number {
  if (!prev || prev.items.length === 0 || nextItems.length === 0) return 0;
  if (prev.target.kind !== target.kind) return 0;
  const prevSelected = prev.items[prev.selectedIndex];
  if (!prevSelected) return 0;
  const sameIdx = nextItems.findIndex((item) => item.key === prevSelected.key);
  if (sameIdx >= 0) return sameIdx;
  return Math.min(prev.selectedIndex, nextItems.length - 1);
}

export function renderHighlightedLabel(label: string, query: string) {
  const q = query.trim();
  if (!q) return label;
  const matchIndex = label.toLowerCase().indexOf(q.toLowerCase());
  if (matchIndex < 0) return label;
  const prefix = label.slice(0, matchIndex);
  const matched = label.slice(matchIndex, matchIndex + q.length);
  const suffix = label.slice(matchIndex + q.length);
  return (
    <>
      {prefix}
      <span className="rounded-sm bg-[hsl(var(--cool-accent)/0.22)] px-0.5 text-[hsl(var(--cool-accent))] font-medium">{matched}</span>
      {suffix}
    </>
  );
}

interface UseComposerAutocompleteOptions {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  inputRef: React.RefObject<string>;
}

export function useComposerAutocomplete({ textareaRef, inputRef }: UseComposerAutocompleteOptions) {
  const [autocomplete, setAutocomplete] = useState<ComposerAutocompleteState | null>(null);
  const requestSeqRef = useRef(0);
  const suppressRefreshRef = useRef(false);

  const update = useCallback(async (value: string, cursor: number) => {
    const target = extractAutocompleteTarget(value, cursor);
    if (!target) {
      requestSeqRef.current += 1;
      setAutocomplete(null);
      return;
    }

    if (target.kind === 'slash') {
      requestSeqRef.current += 1;
      const suggestions = getSlashCommandSuggestions(target.query)
        .slice(0, 8)
        .map<ComposerAutocompleteItem>((cmd) => ({
          key: `slash:${cmd.name}`,
          kind: 'slash',
          insertValue: `/${cmd.name}`,
          label: cmd.usage,
          description: cmd.description,
          appendTrailingSpace: true,
        }));
      if (suggestions.length === 0) { setAutocomplete(null); return; }
      setAutocomplete((prev) => ({
        target,
        items: suggestions,
        selectedIndex: pickSelectedIndex(prev, target, suggestions),
      }));
      return;
    }

    const reqId = requestSeqRef.current + 1;
    requestSeqRef.current = reqId;

    const rootedQuery = target.query.startsWith('/') ? target.query : `/${target.query}`;
    const pathSuggestions = await electronApiClient.autocompletePaths(rootedQuery);
    if (reqId !== requestSeqRef.current) return;
    if (inputRef.current !== value) return;
    const textarea = textareaRef.current;
    if (!textarea || (textarea.selectionStart ?? value.length) !== cursor) return;

    const pathItems = pathSuggestions.slice(0, 8).map<ComposerAutocompleteItem>((item) => ({
      key: `path:${item.value}`,
      kind: 'path',
      insertValue: `@${item.value}`,
      label: item.value,
      description: item.isDirectory ? '目录' : '文件',
      appendTrailingSpace: !item.isDirectory,
      isDirectory: item.isDirectory,
    }));
    if (pathItems.length === 0) { setAutocomplete(null); return; }
    setAutocomplete((prev) => ({
      target,
      items: pathItems,
      selectedIndex: pickSelectedIndex(prev, target, pathItems),
    }));
  }, [textareaRef, inputRef]);

  const refreshFromTextarea = useCallback((valueOverride?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const value = valueOverride ?? textarea.value;
    void update(value, textarea.selectionStart ?? value.length);
  }, [update, textareaRef]);

  const apply = useCallback((index: number, input: string): { value: string; cursor: number } | null => {
    if (!autocomplete) return null;
    const item = autocomplete.items[index];
    if (!item) return null;
    const next = applyAutocompleteReplacement(input, autocomplete.target, item.insertValue, item.appendTrailingSpace);
    return next;
  }, [autocomplete]);

  const dismiss = useCallback(() => {
    requestSeqRef.current += 1;
    setAutocomplete(null);
  }, []);

  return {
    autocomplete,
    setAutocomplete,
    update,
    refreshFromTextarea,
    apply,
    dismiss,
    suppressRefreshRef,
  };
}
