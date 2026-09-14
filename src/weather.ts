const ROLIV = {
  latitude: 49.4439,
  longitude: 23.6159,
  name: 'Ролів',
  sourceUrl: 'https://weather.com/uk-UA/ua/lviv-oblast/city/roliv/today',
};

interface OpenMeteoResponse {
  current?: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
  };
  daily?: {
    sunrise: string[];
    sunset: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
}

const WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: 'ясно',
  1: 'переважно ясно',
  2: 'мінлива хмарність',
  3: 'хмарно',
  45: 'туман',
  48: 'інійний туман',
  51: 'легка мряка',
  53: 'мряка',
  55: 'сильна мряка',
  56: 'легка крижана мряка',
  57: 'сильна крижана мряка',
  61: 'невеликий дощ',
  63: 'дощ',
  65: 'сильний дощ',
  66: 'невеликий крижаний дощ',
  67: 'сильний крижаний дощ',
  71: 'невеликий сніг',
  73: 'сніг',
  75: 'сильний сніг',
  77: 'снігові зерна',
  80: 'невеликі зливи',
  81: 'зливи',
  82: 'сильні зливи',
  85: 'снігові зливи',
  86: 'сильні снігові зливи',
  95: 'гроза',
  96: 'гроза з градом',
  99: 'сильна гроза з градом',
};

function direction(degrees: number): string {
  const names = ['Пн', 'Пн-Сх', 'Сх', 'Пд-Сх', 'Пд', 'Пд-Зх', 'Зх', 'Пн-Зх'];
  return names[Math.round(degrees / 45) % 8];
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function isWeatherRequest(text: string): boolean {
  const normalized = text.trim().toLocaleLowerCase('uk-UA');
  return /^(?:\/weather(?:@\w+)?|\/погода(?:@\w+)?)(?:\s+.*)?$/.test(normalized)
    || /\b(?:яка|яку|який|яке)\s+(?:сьогодні\s+)?погод[аиу]/u.test(normalized)
    || /\bпогод[аиу]\b/u.test(normalized) && /\b(?:сьогодні|зараз|рол(?:ів|ова|еві)|там|на вулиці)\b/u.test(normalized);
}

export async function getRolivWeather(): Promise<string> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(ROLIV.latitude),
    longitude: String(ROLIV.longitude),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
    daily: 'sunrise,sunset,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'Europe/Kyiv',
    forecast_days: '1',
  }).toString();

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Weather API returned ${response.status}`);
  const data = await response.json() as OpenMeteoResponse;
  if (!data.current || !data.daily) throw new Error('Weather API returned incomplete data');

  const current = data.current;
  const daily = data.daily;
  const description = WEATHER_DESCRIPTIONS[current.weather_code] || 'змінна погода';
  const precipitation = current.precipitation > 0 ? `${round(current.precipitation)} мм` : 'немає';
  const rainChance = daily.precipitation_probability_max[0] ?? 0;
  const updated = formatTime(current.time);
  const sunrise = formatTime(daily.sunrise[0]);
  const sunset = formatTime(daily.sunset[0]);

  return [
    `🌤 <b>Погода в Ролеві</b>`,
    `Станом на ${updated}: <b>${round(current.temperature_2m)}°C</b>, ${description}.`,
    `Відчувається як <b>${round(current.apparent_temperature)}°C</b>.`,
    `Вологість: ${current.relative_humidity_2m}%; вітер: ${round(current.wind_speed_10m)} км/год, ${direction(current.wind_direction_10m)}.`,
    `Опади зараз: ${precipitation}; імовірність опадів сьогодні: ${rainChance}%.`,
    `Діапазон сьогодні: ${round(daily.temperature_2m_min[0])}…${round(daily.temperature_2m_max[0])}°C. Схід ${sunrise}, захід ${sunset}.`,
    `Джерело: <a href="${ROLIV.sourceUrl}">Weather.com</a>`,
  ].join('\n');
}
