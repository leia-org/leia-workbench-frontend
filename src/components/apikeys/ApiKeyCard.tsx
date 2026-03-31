import React, { useState } from "react";
import {
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  LinkIcon,
  CubeTransparentIcon,
  EyeSlashIcon
} from "@heroicons/react/24/solid";
import { ApiKey } from "../../models/ApiKeys"; // Asegúrate de que esta ruta sea correcta en tu proyecto

interface ApiKeyCardProps {
  apiKey: ApiKey;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: (keyString: string) => void;
}

export const ApiKeyCard: React.FC<ApiKeyCardProps> = ({ apiKey, onEdit, onDelete, onCopy }) => {
  const [isValueVisible, setIsValueVisible] = useState(false);

  const changeValueVisibility = () => {
    setIsValueVisible(!isValueVisible);
  };

  const getMaskedValue = (value?: string) => {
    if (!value) return "••••••••";
    if (value.length <= 4) return "••••••••";
    const visiblePart = value.substring(0, 3);
    const hiddenPart = "•".repeat(Math.min(value.length - 3, 12));
    return `${visiblePart}${hiddenPart}`;
  };
  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-200 p-6 flex flex-col">

      {/* --- CABECERA --- */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <h3 className="text-xl font-bold text-gray-800">{apiKey.description}</h3>
            {apiKey.isDefault && (
              <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wide">
                Default
              </span>
            )}
          </div>
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
            apiKey.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {apiKey.isActive ? (
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
            ) : (
              <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
            )}
            {apiKey.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={onEdit}
            title="Edit API Key"
            className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm"
          >
            <PencilIcon className="h-5 w-5" />
          </button>
          <button
            onClick={onDelete}
            title="Delete API Key"
            className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm"
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <hr className="border-gray-100 mb-5" />

      {/* --- CUERPO (Datos) --- */}
      <div className="flex-1 space-y-5">

        {/* Valor de la API Key */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">API Key Value</label>
          <div className="flex items-center justify-between mt-1.5 bg-gray-50 border border-gray-200 rounded-lg p-2.5">

            <span className="text-sm font-mono text-gray-800 truncate">
              {isValueVisible ? apiKey.keyValue : getMaskedValue(apiKey.keyValue)}
            </span>

            <div className="flex space-x-2 ml-3 pl-3 border-l border-gray-200">
              <button
                className="text-gray-400 hover:text-gray-700 transition-colors"
                onClick={changeValueVisibility}
                title={isValueVisible ? "Hide value" : "Show value"}
              >
                {isValueVisible ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
              <button onClick={() => onCopy(apiKey.keyValue)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Copy to clipboard">
                <DocumentDuplicateIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 bg-gray-50/50 rounded-lg p-4 border border-gray-100">
          <div className="flex items-start space-x-3">
            <CubeTransparentIcon className="h-5 w-5 text-gray-400 mt-0.5" />
            <div className="overflow-hidden">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Model Name</p>
              <p className="text-sm text-gray-800 font-semibold mt-0.5 truncate">{apiKey.modelName}</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <LinkIcon className="h-5 w-5 text-gray-400 mt-0.5" />
            <div className="overflow-hidden">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Base URL</p>
              <a href={apiKey.baseUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 truncate hover:underline mt-0.5 block">
                {apiKey.baseUrl}
              </a>
            </div>
          </div>

          {apiKey.managementUrl && (
            <div className="flex items-start space-x-3">
              <LinkIcon className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="overflow-hidden">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Management URL</p>
                <a href={apiKey.managementUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 truncate hover:underline mt-0.5 block">
                  {apiKey.managementUrl}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};