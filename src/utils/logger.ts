export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export class Logger {
  private static sanitize(data: any): any {
    if (!data) return data;
    if (typeof data === 'string') {
      // Redact sensitive patterns like tokens, keys, passwords
      return data
        .replace(/bot\d+:[A-Za-z0-9_-]+/gi, 'bot[REDACTED_TOKEN]')
        .replace(/key=[A-Za-z0-9_-]+/gi, 'key=[REDACTED_KEY]')
        .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED_AUTH]');
    }
    if (typeof data === 'object') {
      const sanitized: Record<string, any> = Array.isArray(data) ? [] : {};
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('token') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('key') ||
          lowerKey.includes('password')
        ) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = Logger.sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }
    return data;
  }

  static debug(message: string, context?: Record<string, any>): void {
    console.debug(
      JSON.stringify({
        level: LogLevel.DEBUG,
        timestamp: new Date().toISOString(),
        message,
        context: context ? Logger.sanitize(context) : undefined,
      })
    );
  }

  static info(message: string, context?: Record<string, any>): void {
    console.log(
      JSON.stringify({
        level: LogLevel.INFO,
        timestamp: new Date().toISOString(),
        message,
        context: context ? Logger.sanitize(context) : undefined,
      })
    );
  }

  static warn(message: string, context?: Record<string, any>): void {
    console.warn(
      JSON.stringify({
        level: LogLevel.WARN,
        timestamp: new Date().toISOString(),
        message,
        context: context ? Logger.sanitize(context) : undefined,
      })
    );
  }

  static error(message: string, error?: Error | unknown, context?: Record<string, any>): void {
    const errorDetails = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;

    console.error(
      JSON.stringify({
        level: LogLevel.ERROR,
        timestamp: new Date().toISOString(),
        message,
        error: errorDetails,
        context: context ? Logger.sanitize(context) : undefined,
      })
    );
  }
}
