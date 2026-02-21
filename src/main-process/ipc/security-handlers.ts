import { ipcMain, safeStorage } from 'electron';
import { IPC_CHANNELS } from '../../types';

const PLAIN_TEXT_PREFIX = 'plain:';

function toPlainTextPayload(value: string): string {
  return `${PLAIN_TEXT_PREFIX}${value}`;
}

function isPlainTextPayload(value: string): boolean {
  return value.startsWith(PLAIN_TEXT_PREFIX);
}

function decodePlainTextPayload(value: string): string {
  return value.slice(PLAIN_TEXT_PREFIX.length);
}

function encryptString(data: string): string {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('[main] Encryption unavailable, storing plain text payload');
      return toPlainTextPayload(data);
    }
    return safeStorage.encryptString(data).toString('base64');
  } catch (error) {
    console.error('[main] Encryption error:', error);
    return toPlainTextPayload(data);
  }
}

function decryptString(encryptedData: string): string {
  if (isPlainTextPayload(encryptedData)) {
    return decodePlainTextPayload(encryptedData);
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Decryption not available on this system');
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
