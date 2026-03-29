export interface ApiKey {
  modelName: string;
  baseUrl: string;
  keyValue: string;
  managementUrl: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  apiKeys: ApiKey[];
  id: string;
}

export interface DecodedToken extends User {
  iat: number;
  exp: number;
}