import { LUNA_PERSONALITY } from './personality';
import { LUNA_RULES } from './rules';
import { buildContextPrompt, PromptContextParams } from './context';

export function assembleSystemPrompt(params: PromptContextParams): string {
  const context = buildContextPrompt(params);

  return [
    `=== СИСТЕМНА ІНСТРУКЦІЯ ЛУНИ ===`,
    LUNA_PERSONALITY.trim(),
    LUNA_RULES.trim(),
    context.trim(),
  ].join('\n\n');
}
