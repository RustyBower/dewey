import client from './client';
import type { TokenResponse, User } from '../types';

export async function login(username: string, password: string): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>('/auth/login', {
    username,
    password,
  });
  return data;
}

export async function register(
  username: string,
  email: string,
  password: string
): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>('/auth/register', {
    username,
    email,
    password,
  });
  return data;
}

export async function refresh(): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>('/auth/refresh');
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await client.get<User>('/users/me');
  return data;
}
