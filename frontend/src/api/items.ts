import client from './client';
import type { Item, ItemListResponse, MediaType, ItemStatus, LendingRecord } from '../types';

export interface GetItemsParams {
  page?: number;
  per_page?: number;
  media_type?: MediaType;
  status?: ItemStatus;
  q?: string;
  collection_id?: string;
  tag?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export async function getItems(params?: GetItemsParams): Promise<ItemListResponse> {
  const { data } = await client.get<ItemListResponse>('/items/', { params });
  return data;
}

export async function getItem(id: string): Promise<Item> {
  const { data } = await client.get<Item>(`/items/${id}`);
  return data;
}

export async function createItem(item: Partial<Item> & { cover_url?: string }): Promise<Item> {
  const { data } = await client.post<Item>('/items/', item);
  return data;
}

export async function updateItem(id: string, item: Partial<Item>): Promise<Item> {
  const { data } = await client.patch<Item>(`/items/${id}`, item);
  return data;
}

export async function deleteItem(id: string): Promise<void> {
  await client.delete(`/items/${id}`);
}

export async function previewLibibImport(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await client.post('/import/libib', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function confirmLibibImport(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await client.post('/import/libib/confirm', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function getStats() {
  const { data } = await client.get('/stats/');
  return data;
}

export async function getLendingHistory(itemId: string): Promise<LendingRecord[]> {
  const { data } = await client.get<LendingRecord[]>(`/items/${itemId}/lending`);
  return data;
}

export async function lendItem(
  itemId: string,
  payload: {
    borrower_name: string;
    borrower_contact?: string;
    due_date?: string;
    notes?: string;
  }
): Promise<LendingRecord> {
  const { data } = await client.post<LendingRecord>(`/items/${itemId}/lending`, payload);
  return data;
}

export async function returnItem(itemId: string, lendingId: string): Promise<LendingRecord> {
  const { data } = await client.patch<LendingRecord>(
    `/items/${itemId}/lending/${lendingId}`,
    { returned_at: new Date().toISOString() }
  );
  return data;
}

export async function refreshItemMetadata(itemId: string) {
  const { data } = await client.post(`/refresh/item/${itemId}`);
  return data;
}

export async function refreshAllMetadata() {
  const { data } = await client.post('/refresh/all');
  return data;
}
