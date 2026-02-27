import { useState, useRef, useCallback } from 'react';
import type { ChatImageAttachment } from '../../types';

const MAX_ATTACHMENT_IMAGES = 6;
const MAX_ATTACHMENT_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const IMAGE_FILE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.heic', '.heif',
]);

type PastedImageDraft = ChatImageAttachment;

function formatSizeLabel(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes}B`;
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))}KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function isLikelyImageFile(file: Pick<File, 'name' | 'type'>): boolean {
  if (file.type.startsWith('image/')) return true;
  const dotIndex = file.name.lastIndexOf('.');
  if (dotIndex < 0) return false;
  return IMAGE_FILE_EXTENSIONS.has(file.name.slice(dotIndex).toLowerCase());
}

export function hasImageInDataTransfer(dataTransfer: DataTransfer): boolean {
  const items = Array.from(dataTransfer.items ?? []);
  if (items.some((item) => item.kind === 'file' && (item.type.startsWith('image/') || !item.type))) return true;
  return Array.from(dataTransfer.files ?? []).some((file) => isLikelyImageFile(file));
}

export function collectImageFiles(dataTransfer: DataTransfer): File[] {
  const itemFiles = Array.from(dataTransfer.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file))
    .filter((file) => isLikelyImageFile(file));
  if (itemFiles.length > 0) return itemFiles;
  return Array.from(dataTransfer.files ?? []).filter((file) => isLikelyImageFile(file));
}

interface UseImageAttachmentsOptions {
  onHint: (hint: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function useImageAttachments({ onHint, textareaRef }: UseImageAttachmentsOptions) {
  const [pastedImages, setPastedImages] = useState<PastedImageDraft[]>([]);
  const [isDropActive, setIsDropActive] = useState(false);
  const pastedImagesRef = useRef<PastedImageDraft[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const composerDragDepthRef = useRef(0);

  // Keep ref in sync
  const syncRef = useCallback((images: PastedImageDraft[]) => {
    pastedImagesRef.current = images;
  }, []);

  const setImages = useCallback((updater: PastedImageDraft[] | ((prev: PastedImageDraft[]) => PastedImageDraft[])) => {
    setPastedImages((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      pastedImagesRef.current = next;
      return next;
    });
  }, []);

  const readImageAsDataUrl = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') { resolve(reader.result); return; }
        reject(new Error('读取图片失败：无效的 DataURL'));
      };
      reader.onerror = () => reject(new Error('读取图片失败'));
      reader.readAsDataURL(file);
    });
  }, []);

  const appendImageFiles = useCallback(async (files: File[], sourceLabel: '粘贴' | '拖拽' | '选择') => {
    if (files.length === 0) return;

    const normalizedFiles = files.filter((file) => isLikelyImageFile(file));
    if (normalizedFiles.length === 0) {
      onHint('未检测到可用图片，请选择图片文件后重试。');
      return;
    }

    const existingImages = pastedImagesRef.current;
    const remainingSlots = Math.max(0, MAX_ATTACHMENT_IMAGES - existingImages.length);
    if (remainingSlots <= 0) {
      onHint(`最多添加 ${MAX_ATTACHMENT_IMAGES} 张图片，请先移除部分附件。`);
      return;
    }

    const selectedFiles = normalizedFiles.slice(0, remainingSlots);
    const skippedByLimit = Math.max(0, normalizedFiles.length - selectedFiles.length);
    const nextImages: PastedImageDraft[] = [];
    let skippedOversizeCount = 0;
    let hasReadFailure = false;

    for (const file of selectedFiles) {
      if (file.size > MAX_ATTACHMENT_IMAGE_SIZE_BYTES) { skippedOversizeCount += 1; continue; }
      try {
        const dataUrl = await readImageAsDataUrl(file);
        nextImages.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          name: file.name || '未命名图片',
          mimeType: file.type || 'image/*',
          sizeBytes: file.size,
          dataUrl,
        });
      } catch { hasReadFailure = true; }
    }

    if (nextImages.length > 0) {
      setImages((prev) => [...prev, ...nextImages].slice(0, MAX_ATTACHMENT_IMAGES));
    }

    const hintParts: string[] = [];
    if (nextImages.length > 0) hintParts.push(`${sourceLabel}添加 ${nextImages.length} 张图片`);
    if (skippedByLimit > 0) hintParts.push(`${skippedByLimit} 张超出上限已跳过`);
    if (skippedOversizeCount > 0) hintParts.push(`${skippedOversizeCount} 张超过 ${formatSizeLabel(MAX_ATTACHMENT_IMAGE_SIZE_BYTES)} 已跳过`);
    if (hasReadFailure) hintParts.push('部分图片读取失败');
    if (hintParts.length > 0) onHint(`${hintParts.join('，')}。`);

    requestAnimationFrame(() => { textareaRef.current?.focus(); });
  }, [onHint, readImageAsDataUrl, setImages, textareaRef]);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }, [setImages]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = collectImageFiles(e.clipboardData);
    if (files.length === 0) return;
    e.preventDefault();
    await appendImageFiles(files, '粘贴');
  }, [appendImageFiles]);

  const openPicker = useCallback(() => { imageInputRef.current?.click(); }, []);

  const handlePickerChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) await appendImageFiles(files, '选择');
    e.target.value = '';
  }, [appendImageFiles]);

  const resetDropState = useCallback(() => {
    composerDragDepthRef.current = 0;
    setIsDropActive(false);
  }, []);

  const dragHandlers = {
    onDragEnter: useCallback((e: React.DragEvent<HTMLDivElement>) => {
      if (!hasImageInDataTransfer(e.dataTransfer)) return;
      e.preventDefault();
      composerDragDepthRef.current += 1;
      setIsDropActive(true);
    }, []),
    onDragOver: useCallback((e: React.DragEvent<HTMLDivElement>) => {
      if (!hasImageInDataTransfer(e.dataTransfer)) return;
      e.preventDefault();
      setIsDropActive(true);
    }, []),
    onDragLeave: useCallback((e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      composerDragDepthRef.current = Math.max(0, composerDragDepthRef.current - 1);
      if (composerDragDepthRef.current === 0) setIsDropActive(false);
    }, []),
    onDrop: useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      composerDragDepthRef.current = 0;
      setIsDropActive(false);
      const files = collectImageFiles(e.dataTransfer);
      await appendImageFiles(files, '拖拽');
    }, [appendImageFiles]),
    onDragEnd: resetDropState,
  };

  const removeLastImage = useCallback(() => {
    setImages((prev) => prev.slice(0, -1));
    onHint('已移除最后一张图片。');
  }, [setImages, onHint]);

  return {
    pastedImages,
    setPastedImages: setImages,
    isDropActive,
    imageInputRef,
    maxImages: MAX_ATTACHMENT_IMAGES,
    removeImage,
    removeLastImage,
    handlePaste,
    openPicker,
    handlePickerChange,
    dragHandlers,
    syncRef,
  };
}
