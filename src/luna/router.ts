export type LunaIntent =
  | 'GENERAL_CHAT'
  | 'IMAGE_ANALYSIS'
  | 'SCHOOL_TASK'
  | 'CONTROL_WORK'
  | 'MATH_SOLVE'
  | 'WEB_SEARCH'
  | 'WEATHER'
  | 'REMINDER';

export interface IntentResult {
  intent: LunaIntent;
  confidence: 'high' | 'medium' | 'low';
}

/** Lightweight routing only. The LLM remains responsible for the final answer. */
export class IntentRouter {
  detectText(text: string): IntentResult {
    const value = text.trim().toLowerCase();

    if (/^нагадай(?:\s+мені)?\b/.test(value)) {
      return { intent: 'REMINDER', confidence: 'high' };
    }
    if (/(погод|температур|дощ|сніг|вітер|градус)/.test(value)) {
      return { intent: 'WEATHER', confidence: 'high' };
    }
    if (/(розв['’ʼ]?яж|рівнян|обчисл|дискримінант|інтеграл|похідн|формул|x\s*[²2]|[0-9]+\s*[+\-*/=]\s*[0-9]+)/.test(value)) {
      return { intent: 'MATH_SOLVE', confidence: 'medium' };
    }
    if (/(контрольн|самостійн|варіант\s*\d|гдз|домашн|завдан|підручник|клас|алгебр|геометр|фізик|хімі|біолог)/.test(value)) {
      return { intent: /(контрольн|самостійн|варіант)/.test(value) ? 'CONTROL_WORK' : 'SCHOOL_TASK', confidence: 'medium' };
    }
    if (/(знайди|пошукай|пошук|в інтернеті|джерел|сайт|новин)/.test(value)) {
      return { intent: 'WEB_SEARCH', confidence: 'medium' };
    }
    return { intent: 'GENERAL_CHAT', confidence: 'low' };
  }

  detectPhoto(caption?: string): IntentResult {
    if (!caption?.trim()) return { intent: 'IMAGE_ANALYSIS', confidence: 'high' };
    const fromCaption = this.detectText(caption);
    if (fromCaption.intent === 'CONTROL_WORK' || fromCaption.intent === 'SCHOOL_TASK' || fromCaption.intent === 'MATH_SOLVE') {
      return fromCaption;
    }
    return { intent: 'IMAGE_ANALYSIS', confidence: 'high' };
  }
}
