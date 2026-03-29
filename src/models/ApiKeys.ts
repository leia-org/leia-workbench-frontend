export interface ApiKey {
  id: string;
  description: string;
  modelName: string;
  baseUrl: string;
  keyValue: string;
  managementUrl: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}