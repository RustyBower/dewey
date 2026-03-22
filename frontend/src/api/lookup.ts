import client from './client';
import type { MetadataResult, MediaType } from '../types';

export async function lookupBarcode(code: string): Promise<MetadataResult[]> {
  const { data } = await client.get<MetadataResult[]>('/lookup/barcode', {
    params: { barcode: code },
  });
  return data;
}

export async function searchMetadata(
  query: string,
  mediaType?: MediaType
): Promise<MetadataResult[]> {
  const { data } = await client.get<MetadataResult[]>('/lookup/search', {
    params: { query, media_type: mediaType },
  });
  return data;
}
