import { ipcMain, safeStorage } from 'electron';
import { IPC_CHANNELS } from '../../types';

const PLAIN_TEXT_PREFIX = 'plain:';

function isPlainTextPayload(value: string): boolean {
  return value.startsWith(PLAIN_TEXT_PREFIX);
}

function decodePlainTextPayload(value: string): string {
  return value.slice(PLAIN_TEXT_PREFIX.length);
}

function buildEncryptionUnavailableMessage(): string {
  return '当前系统不支持 safeStorage 加密，已阻止保存 API Key，避免降级为明文存储。';
}

function encryptString(data: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(buildEncryptionUnavailableMessage());
  }

  try {
    return safeStorage.encryptString(data).toString('base64');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown encryption failure';
    throw new Error(`API Key 加密失败: ${message}`);
  }
}

function decryptString(encryptedData: string): string {
  if (isPlainTextPayload(encryptedData)) {
    console.warn('[main] Legacy plaintext credential detected in local storage.');
    return decodePlainTextPayload(encryptedData);
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('当前系统不支持 safeStorage 解密。');
  }

  try {
    const encryptedBuffer = Buffer.from(encryptedData, 'base64');
    return safeStorage.decryptString(encryptedBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Decryption failed';
    throw new Error(`Failed to decrypt data: ${message}`);
  }
}

export function registerSecurityHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.ENCRYPT_DATA, async (_event, data: string): Promise<string> => {
    return encryptString(data);
  });

  ipcMain.handle(IPC_CHANNELS.DECRYPT_DATA, async (_event, encryptedData: string): Promise<string> => {
    return decryptString(encryptedData);
  });
}
