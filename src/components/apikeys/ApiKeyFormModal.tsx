import React from "react";
import { ApiKey } from "../../models/ApiKeys";

interface ApiKeyFormModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  selectedKey: ApiKey | null;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
}

export const ApiKeyFormModal: React.FC<ApiKeyFormModalProps> = ({ isOpen, mode, selectedKey, onClose, onSave }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">
            {mode === "create" ? "Add New API Key" : "Edit API Key"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={onSave} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key Name</label>
              <input type="text" defaultValue={selectedKey?.description || ""} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. Production Key" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key Value</label>
              <input type="text" defaultValue={selectedKey?.keyValue || ""} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500 font-mono" placeholder="sk-..." required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model Name</label>
                <input type="text" defaultValue={selectedKey?.modelName || ""} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. Llama-3" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500" defaultValue={selectedKey?.isActive ? "Active" : "Inactive"}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
              <input type="url" defaultValue={selectedKey?.baseUrl || ""} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500 text-blue-600" placeholder="https://..." required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Management URL <span className="text-gray-400 font-normal">(Optional)</span></label>
              <input type="url" defaultValue={selectedKey?.managementUrl || ""} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500 text-blue-600" placeholder="https://..." />
            </div>
            <div className="flex items-center mt-2">
              <input type="checkbox" id="defaultKey" defaultChecked={selectedKey?.isDefault || false} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
              <label htmlFor="defaultKey" className="ml-2 block text-sm text-gray-900">
                Set as Default Key
              </label>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end space-x-3 bg-gray-50">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-[#3ab55b] text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium">
              {mode === "create" ? "Create Key" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
