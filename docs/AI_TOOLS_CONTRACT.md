# Luna AI Tools and Search contracts

The Cloudflare Worker remains the Telegram/webhook coordinator. Heavy vision OCR, browser automation, search, math validation, and document generation can be deployed separately and exposed over HTTPS.

## Image analysis

`POST {AI_TOOLS_URL}/v1/analyze-image`

Headers:

```text
Content-Type: application/json
Authorization: Bearer {AI_TOOLS_SECRET}
```

Request:

```json
{
  "image_base64": "...",
  "mime_type": "image/jpeg",
  "caption": "розв'яжи завдання на фото",
  "capabilities": ["vision", "ocr", "school_task_detection", "math_validation"]
}
```

Response:

```json
{
  "text": "Це завдання з алгебри...",
  "intent": "SCHOOL_TASK",
  "extractedText": "2x + 5 = 15",
  "tasks": [{ "number": 1, "text": "2x + 5 = 15" }]
}
```

The Worker accepts only a bounded image payload (currently 5 MB), uses Telegram `getFile`, and never stores the raw image in Mem0. The external service should treat OCR text as untrusted user data and must not bypass CAPTCHA, paywalls, authentication, or anti-bot controls.

## SerpAPI search

When the intent router detects a web-search request and `SEARCH_API_KEY` is configured, the Worker calls SerpAPI directly over HTTPS:

```text
GET https://serpapi.com/search.json
  ?engine=google
  &q=...
  &location=Ukraine
  &hl=uk
  &gl=ua
  &google_domain=google.com.ua
  &api_key=...
```

The API key is never sent to the model or logged. Only result title, URL, and snippet are placed into a clearly marked untrusted context block before Luna writes the answer. The default search region can be changed with `SEARCH_LOCATION`, `SEARCH_HL`, `SEARCH_GL`, and `SEARCH_GOOGLE_DOMAIN`.

## Environment variables

Worker secrets/vars:

```text
AI_TOOLS_URL=https://your-tool-service.example.com
AI_TOOLS_SECRET=...
VISION_AI_API_KEY=...        # optional lightweight Gemini fallback
VISION_AI_MODEL_NAME=gemini-3.6-flash
SEARCH_API_KEY=...           # SerpAPI secret
SEARCH_LOCATION=Ukraine
SEARCH_HL=uk
SEARCH_GL=ua
SEARCH_GOOGLE_DOMAIN=google.com.ua
```

If `AI_TOOLS_URL` is present it is preferred. If it is absent and `VISION_AI_API_KEY` is present, the Worker calls Gemini Vision directly for general image understanding. If neither is configured, Luna responds honestly that photo analysis is not configured.

The current Groq chat model remains unchanged. It is not used for image payloads.
