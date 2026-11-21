import type { DataSource, LoginCredentials } from '../adapters/dataSource';

export const healthService = {
  keys: {
    health: (mode: string) => ['health', mode] as const,
    authMe: (mode: string) => ['auth', 'me', mode] as const,
  },
  checkHealth: (ds: DataSource) => ds.health(),
  authMe: (ds: DataSource) => ds.authMe(),
  login: (ds: DataSource, credentials: LoginCredentials) => ds.authLogin(credentials),
  logout: (ds: DataSource) => ds.authLogout(),
};
