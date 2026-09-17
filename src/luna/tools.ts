import { TelegramApi } from '../telegram/api';
import { Logger } from '../utils/logger';

export interface VisionResult {
  text: string;
  intent?: string;
  extractedText?: string;
  tasks?: Array<{ number?: number; text: string }>;
}

export interface ToolServiceConfig {
  url?: string;
  secret?: string;
  visionApiKey?: string;
  visionModel?: string;
}

/**
 * Image/tool boundary for the Worker. Heavy OCR, browser automation and
 * document generation belong behind TOOL_SERVICE_URL; Gemini is a lightweight
 * fallback so ordinary image understanding can work without Python.
 */
export class LunaToolService {
  constructor(
    private readonly telegram: TelegramApi,
    private readonly config: ToolServiceConfig
  ) {}

  async analyzeTelegramPhoto(fileId: string, caption?: string): Promise<VisionResult> {
    const file = await this.telegram.getFile(fileId);
    if (!file.file_path) throw new Error('Telegram did not return a file path.');

    const bytes = await this.telegram.downloadFile(file.file_path);
    if (bytes.byteLength > 5 * 1024 * 1024) {
      throw new Error('Фото завелике для обробки. Надішли зображення до 5 МБ.');
    }

    const mimeType = this.mimeTypeFor(file.file_path);
    if (this.config.url) {
      return this.callToolService(bytes, mimeType, caption);
    }
    if (this.config.visionApiKey) {
      return this.callGeminiVision(bytes, mimeType, caption);
    }
    throw new Error('Для аналізу фото не налаштовано Vision-сервіс.');
  }

  private async callToolService(bytes: ArrayBuffer, mimeType: string, caption?: string): Promise<VisionResult> {
    const response = await fetch(`${this.config.url!.replace(/\/$/, '')}/v1/analyze-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.secret ? { Authorization: `Bearer ${this.config.secret}` } : {}),
      },
      body: JSON.stringify({
        image_base64: this.toBase64(bytes),
        mime_type: mimeType,
        caption: caption || '',
        capabilities: ['vision', 'ocr', 'school_task_detection', 'math_validation'],
      }),
    });

    if (!response.ok) {
      throw new Error(`Tool service returned HTTP ${response.status}`);
    }
    const result = await response.json() as VisionResult;
    if (!result.text) throw new Error('Tool service returned an empty result.');
    return result;
  }

  private async callGeminiVision(bytes: ArrayBuffer, mimeType: string, caption?: string): Promise<VisionResult> {
    const model = this.config.visionModel || 'gemini-3.6-flash';
    const prompt = `Проаналізуй це зображення для користувача Luna.
Визнач, що на ньому зображено. Якщо це навчальне завдання, розпізнай умову, предмет, клас і номери завдань та допоможи розв'язати їх. Якщо це звичайне фото, просто опиши його. Не вигадуй текст, якого не видно. Відповідай українською природно й без обов'язкових емодзі.${caption ? `
Підпис користувача: ${caption}` : ''}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.visionApiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: this.toBase64(bytes) } },
          ],
        }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1400 },
      }),
    });
    if (!response.ok) {
      Logger.warn(`Gemini Vision returned HTTP ${response.status}`);
      throw new Error('Vision AI не зміг проаналізувати фото.');
    }
    const data = await response.json() as any;
    const text = data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('').trim();
    if (!text) throw new Error('Vision AI повернув порожню відповідь.');
    return { text: this.cleanModelText(text), intent: 'IMAGE_ANALYSIS' };
  }

  private cleanModelText(text: string): string {
    return text
      .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
      .replace(/\[EMOTION:\s*(idle|happy|sad|angry|sleepy|love|confused|surprised)\s*\]/gi, '')
      .trim();
  }

  private toBase64(bytes: ArrayBuffer): string {
    const view = new Uint8Array(bytes);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < view.length; i += chunkSize) {
      binary += String.fromCharCode(...view.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  private mimeTypeFor(path: string): string {
    const extension = path.split('.').pop()?.toLowerCase();
    if (extension === 'png') return 'image/png';
    if (extension === 'webp') return 'image/webp';
    return 'image/jpeg';
  }
}
