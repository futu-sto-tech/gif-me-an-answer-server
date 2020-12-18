import axios from 'axios';
import config from '../config';

const client = axios.create({
  baseURL: config.GIPHY_URL,
});
client.defaults.params = {
  api_key: config.GIPHY_TOKEN,
  limit: config.GIPHY_LIMIT,
  lang: config.GIPHY_LANGUAGE,
};

interface ImageObject {
  url: string;
  width: string;
  height: string;
  webp: string;
}

interface GiphySearchResult {
  data: {
    id: string;
    title: string;
    images: {
      preview_gif: ImageObject;
      original: ImageObject;
      fixed_width: ImageObject;
    };
  }[];
}

export interface Gif {
  id: string;
  title: string;
  preview: Omit<ImageObject, 'webp'>;
  original: Omit<ImageObject, 'webp'>;
  fixedWidth: Omit<ImageObject, 'width' | 'height'>;
}

export async function search(query: string): Promise<Gif[]> {
  const res = await client.get<GiphySearchResult>('/search', { params: { q: query } });

  return res.data.data.map((gif) => ({
    id: gif.id,
    title: gif.title,
    preview: {
      url: gif.images.preview_gif.url,
      width: gif.images.preview_gif.width,
      height: gif.images.preview_gif.height,
    },
    original: {
      url: gif.images.original.url,
      width: gif.images.original.width,
      height: gif.images.original.height,
    },
    fixedWidth: {
      url: gif.images.fixed_width.url,
      webp: gif.images.fixed_width.webp,
    },
  }));
}
