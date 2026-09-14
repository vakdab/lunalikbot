/**
 * Telegram sendMessage defaults to parse_mode HTML. Luna's replies, reminder
 * text, and first names are free-form (AI-generated or user-typed) and never
 * contain intentional markup, so any stray `<`, `>` or `&` in them (e.g. an
 * unbalanced `<thought>` tag that survives truncation, a raw "<3", or a name
 * with special characters) makes Telegram reject the whole message with
 * "can't parse entities". Escaping before interpolation keeps the text safe
 * without needing real HTML anywhere in these messages.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
