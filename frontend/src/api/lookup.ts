import client from './client';
import type { Item, MetadataResult, MediaType } from '../types';

export interface BarcodeLookupResponse {
  existing: Item | null;
  results: MetadataResult[];
}

export async function lookupBarcode(code: string): Promise<BarcodeLookupResponse> {
  const { data } = await client.get<BarcodeLookupResponse>(`/lookup/barcode/${code}`);
  return data;
}

export async function searchMetadata(
  query: string,
  mediaType?: MediaType
): Promise<MetadataResult[]> {
  const { data } = await client.get<MetadataResult[]>('/lookup/search', {
    params: { q: query, media_type: mediaType },
  });
  return data;
}
