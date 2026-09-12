export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly userFacingMessage?: string;

  constructor(message: string, code: string = 'INTERNAL_ERROR', statusCode: number = 500, userFacingMessage?: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.userFacingMessage = userFacingMessage;
  }
}

export class TelegramAPIError extends AppError {
  constructor(message: string, statusCode: number = 502) {
    super(message, 'TELEGRAM_API_ERROR', statusCode, 'Помилка взаємодії з Telegram API. Будь ласка, спробуйте пізніше.');
  }
}

export class AIProviderError extends AppError {
  constructor(message: string, statusCode: number = 502) {
    super(message, 'AI_PROVIDER_ERROR', statusCode, 'Луна зараз трохи замислилася... Спробуй написати ще раз через хвилинку.');
  }
}

export class MemoryServiceError extends AppError {
  constructor(message: string) {
    super(message, 'MEMORY_SERVICE_ERROR', 500);
  }
}

export class RouletteError extends AppError {
  constructor(message: string, userFacingMessage?: string) {
    super(message, 'ROULETTE_ERROR', 400, userFacingMessage);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized webhook signature') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, 'Занадто багато повідомлень! Зачекай кілька секунд перед наступним.');
  }
}
