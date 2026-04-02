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
  isSystemApiKey?: boolean;
}

export interface ApiKeyFormData {
  description: string | undefined;
  modelName: string | undefined;
  baseUrl: string | undefined;
  keyValue: string | undefined;
  managementUrl?: string | undefined;
  isActive: boolean | undefined;
  isDefault?: boolean | undefined;
}