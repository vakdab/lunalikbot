import { LLaVAVisionService, LLaVAResponse } from './llava';
import { PaddleOCRService, OCRResult } from './paddle-ocr';
import { Logger } from '../../utils/logger';

export interface CombinedVisionResult {
  vision: LLaVAResponse;
  ocr: OCRResult;
  combined: string;
  intent: 'school_task' | 'document' | 'image' | 'unknown';
}

/**
 * Комбинированный анализ: LLaVA для понимания + PaddleOCR для текста
 * Luna может видеть фото как человек И читать текст одновременно
 */
export class CombinedVisionService {
  constructor(
    private readonly llava: LLaVAVisionService,
    private readonly ocr: PaddleOCRService
  ) {}

  async analyzeImage(
    imageBase64: string,
    mimeType: string,
    userCaption?: string
  ): Promise<CombinedVisionResult> {
    const startTime = Date.now();

    try {
      // Запускаем обе операции параллельно для скорости
      const [visionResult, ocrResult] = await Promise.all([
        this.llava.analyzeImage(
          imageBase64,
          mimeType,
          userCaption ? `Користувач написав: "${userCaption}". ${this.getVisionPrompt()}` : this.getVisionPrompt()
        ),
        this.ocr.extractText(imageBase64, mimeType).catch(err => {
          Logger.warn('OCR failed, continuing with vision only', err);
          return {
            text: '[OCR не змогла розпізнати текст]',
            confidence: 0,
            lines: [],
          };
        }),
      ]);

      const duration = Date.now() - startTime;
      Logger.info(`Vision analysis completed in ${duration}ms`, {
        visionLength: visionResult.text.length,
        ocrLength: ocrResult.text.length,
      });

      // Визначаємо намір з результатів
      const intent = this.detectIntent(visionResult, ocrResult, userCaption);

      // Комбінуємо результати для максимальної інформативності
      const combined = this.combineResults(visionResult, ocrResult, intent);

      return {
        vision: visionResult,
        ocr: ocrResult,
        combined,
        intent,
      };
    } catch (err) {
      Logger.error('Combined vision analysis failed', err);
      throw err;
    }
  }

  /**
   * Аналіз для шкільних завдань (оптимізовано для точності)
   */
  async analyzeSchoolTask(
    imageBase64: string,
    mimeType: string,
    userCaption?: string
  ): Promise<CombinedVisionResult> {
    try {
      const [visionResult, ocrResult] = await Promise.all([
        this.llava.analyzeSchoolTask(imageBase64, mimeType),
        this.ocr.extractSchoolTaskText(imageBase64, mimeType).then(text => ({
          text,
          confidence: 0.85,
          lines: text.split('\n').map(line => ({ text: line, confidence: 0.85 })),
        })),
      ]);

      const combined = this.combineResults(visionResult, ocrResult, 'school_task');

      return {
        vision: visionResult,
        ocr: ocrResult,
        combined,
        intent: 'school_task',
      };
    } catch (err) {
      Logger.error('School task analysis failed', err);
      throw err;
    }
  }

  private getVisionPrompt(): string {
    return `Опиши що ти бачиш на фото як справжня людина. Якщо це завдання з підручника, назви предмет і опиши умову. Якщо це скрін - розкажи про вміст. Коротко, точно, природньо.`;
  }

  private detectIntent(
    vision: LLaVAResponse,
    ocr: OCRResult,
    caption?: string
  ): 'school_task' | 'document' | 'image' | 'unknown' {
    const visionLower = vision.text.toLowerCase();
    const ocrLower = ocr.text.toLowerCase();

    // Признаки школьного задания
    const schoolKeywords = /завдання|задача|рівнян|розв[''ʼ]?яж|контрольн|самостійн|домашн|примір|математик|фізик|хімі|біолог|геометр|алгебр|укра[ї]?нськ|англійськ/i;

    if (schoolKeywords.test(visionLower) || schoolKeywords.test(ocrLower)) {
      return 'school_task';
    }

    // Признаки документа (много текста, структура)
    if (ocr.text.length > 200 && ocr.confidence > 0.7) {
      return 'document';
    }

    // Просто фото
    return 'image';
  }

  private combineResults(
    vision: LLaVAResponse,
    ocr: OCRResult,
    intent: 'school_task' | 'document' | 'image' | 'unknown'
  ): string {
    let combined = '';

    // Приоритет в зависимости от типа
    if (intent === 'school_task') {
      // Для завдань: сначала структурированный анализ из LLaVA, потом точный текст из OCR
      combined = `📚 Завдання розпізнано:\n${vision.text}`;
      if (ocr.text.length > 0) {
        combined += `\n\n📝 Текст завдання:\n${ocr.text}`;
      }
    } else if (intent === 'document') {
      // Для документов: текст на первое место
      combined = `📄 Вміст документа:\n${ocr.text}`;
      if (vision.text.length > 0) {
        combined += `\n\n💡 Контекст:\n${vision.text}`;
      }
    } else {
      // Для обычных фото: описание + текст если есть
      combined = vision.text;
      if (ocr.text.length > 50 && ocr.confidence > 0.6) {
        combined += `\n\n📋 Видимий текст:\n${ocr.text}`;
      }
    }

    return combined.trim();
  }
}
