import client from './client';
import type { Item, ItemListResponse, MediaType, ItemStatus, LendingRecord } from '../types';

export interface GetItemsParams {
  page?: number;
  per_page?: number;
  media_type?: MediaType;
  status?: ItemStatus;
  search?: string;
  collection_id?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export async function getItems(params?: GetItemsParams): Promise<ItemListResponse> {
  const { data } = await client.get<ItemListResponse>('/items', { params });
  return data;
}

export async function getItem(id: number): Promise<Item> {
  const { data } = await client.get<Item>(`/items/${id}`);
  return data;
}

export async function createItem(item: Partial<Item>): Promise<Item> {
  const { data } = await client.post<Item>('/items', item);
  return data;
}

export async function updateItem(id: number, item: Partial<Item>): Promise<Item> {
  const { data } = await client.put<Item>(`/items/${id}`, item);
  return data;
}

export async function deleteItem(id: number): Promise<void> {
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

export async function getLendingHistory(itemId: number): Promise<LendingRecord[]> {
  const { data } = await client.get<LendingRecord[]>(`/items/${itemId}/lendings`);
  return data;
}

export async function lendItem(
  itemId: number,
  payload: {
    borrower_name: string;
    borrower_contact?: string;
    due_date?: string;
    notes?: string;
  }
): Promise<LendingRecord> {
  const { data } = await client.post<LendingRecord>(`/items/${itemId}/lendings`, payload);
  return data;
}

export async function returnItem(itemId: number, lendingId: number): Promise<LendingRecord> {
  const { data } = await client.post<LendingRecord>(
    `/items/${itemId}/lendings/${lendingId}/return`
  );
  return data;
}
