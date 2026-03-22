import client from './client';
import type { Collection } from '../types';

export async function getCollections(): Promise<Collection[]> {
  const { data } = await client.get<Collection[]>('/collections');
  return data;
}

export async function createCollection(
  collection: Partial<Collection>
): Promise<Collection> {
  const { data } = await client.post<Collection>('/collections', collection);
  return data;
}

export async function updateCollection(
  id: number,
  collection: Partial<Collection>
): Promise<Collection> {
  const { data } = await client.put<Collection>(`/collections/${id}`, collection);
  return data;
}

export async function deleteCollection(id: number): Promise<void> {
  await client.delete(`/collections/${id}`);
}

export async function addItemsToCollection(
  collectionId: number,
  itemIds: number[]
): Promise<void> {
  await client.post(`/collections/${collectionId}/items`, { item_ids: itemIds });
}

export async function removeItemFromCollection(
  collectionId: number,
  itemId: number
): Promise<void> {
  await client.delete(`/collections/${collectionId}/items/${itemId}`);
}
