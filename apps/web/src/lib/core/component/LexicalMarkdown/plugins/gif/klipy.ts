import { z } from 'zod';

// Klipy keys are meant to ship in the client: its terms require requests to
// come from the user's browser, not a proxy.
const KLIPY_API_KEY = '';
// Klipy serves Tenor's v2 API shape.
const KLIPY_BASE_URL = 'https://api.klipy.com/v2';
const MEDIA_FILTER = 'gif,tinygif,nanogif,mediumgif';
const CONTENT_FILTER = 'medium';

export interface Gif {
  id: string;
  title: string;
  previewUrl: string;
  url: string;
  width: number;
  height: number;
}

const mediaFormatSchema = z.object({
  url: z.string(),
  dims: z.tuple([z.number(), z.number()]),
});

const resultSchema = z.object({
  id: z.string(),
  title: z.string(),
  media_formats: z.object({
    gif: mediaFormatSchema.optional(),
    mediumgif: mediaFormatSchema.optional(),
    tinygif: mediaFormatSchema.optional(),
    nanogif: mediaFormatSchema.optional(),
  }),
});

const responseSchema = z.object({ results: z.array(resultSchema) });

function toGif(result: z.infer<typeof resultSchema>): Gif | null {
  const gif = result.media_formats.gif ?? result.media_formats.mediumgif;
  const preview = result.media_formats.tinygif ?? result.media_formats.nanogif;
  if (!gif || !preview) return null;

  return {
    id: result.id,
    title: result.title,
    previewUrl: preview.url,
    url: gif.url,
    width: gif.dims[0],
    height: gif.dims[1],
  };
}

async function fetchGifs(
  endpoint: 'search' | 'featured',
  params: Record<string, string>
): Promise<Gif[]> {
  const query = new URLSearchParams({
    key: KLIPY_API_KEY,
    media_filter: MEDIA_FILTER,
    contentfilter: CONTENT_FILTER,
    ...params,
  });
  const response = await fetch(`${KLIPY_BASE_URL}/${endpoint}?${query}`);
  if (!response.ok) {
    throw new Error(`Klipy API error: ${response.status}`);
  }

  const data = responseSchema.parse(await response.json());
  return data.results.map(toGif).filter((gif) => gif !== null);
}

export function searchGifs(query: string, limit = 20): Promise<Gif[]> {
  if (!query.trim()) return fetchTrendingGifs(limit);
  return fetchGifs('search', { q: query, limit: String(limit) });
}

export function fetchTrendingGifs(limit = 20): Promise<Gif[]> {
  return fetchGifs('featured', { limit: String(limit) });
}
