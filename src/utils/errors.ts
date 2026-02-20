/**
 * Custom error classes for AI Desktop Assistant
 */

/**
 * Base application error
 */
export class AppError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

/**
 * Error thrown when API key is missing or invalid
 */
export class APIKeyError extends AppError {
  constructor(message: string = 'API key is missing or invalid') {
    super(message, 'API_KEY_ERROR');
    this.name = 'APIKeyError';
  }
}

/**
 * Error thrown when API request fails
 */
export class APIRequestError extends AppError {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message, 'API_REQUEST_ERROR');
    this.name = 'APIRequestError';
    this.statusCode = statusCode;
  }
}

/**
 * Error thrown when stream operation is aborted
 */
export class StreamAbortedError extends AppError {
  constructor(message: string = 'Stream operation was aborted') {
    super(message, 'STREAM_ABORTED');
    this.name = 'StreamAbortedError';
  }
}

/**
 * Error thrown when encryption/decryption fails
 */
export class EncryptionError extends AppError {
  constructor(message: string = 'Failed to encrypt or decrypt data') {
    super(message, 'ENCRYPTION_ERROR');
    this.name = 'EncryptionError';
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigError extends AppError {
  constructor(message: string = 'Invalid configuration') {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}

/**
 * Error thrown when service is not initialized
 */
export class ServiceNotInitializedError extends AppError {
  constructor(serviceName: string = 'Service') {
    super(`${serviceName} is not initialized`, 'SERVICE_NOT_INITIALIZED');
    this.name = 'ServiceNotInitializedError';
  }
}

/**
 * Helper function to create user-friendly error messages
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error) {
    // Handle common API error patterns
    const message = error.message.toLowerCase();

    if (message.includes('api key') || message.includes('unauthorized') || message.includes('401')) {
      return 'API key is invalid or expired. Please check your API key in Settings.';
    }

    if (message.includes('rate limit') || message.includes('429')) {
      return 'Rate limit exceeded. Please wait a moment and try again.';
    }

    if (message.includes('network') || message.includes('enotfound') || message.includes('econnrefused')) {
      return 'Network error. Please check your internet connection.';
    }

    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}
