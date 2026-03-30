import React, { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { ApiKeyCard } from "../components/apikeys/ApiKeyCard";
import { ApiKeyFormModal } from "../components/apikeys/ApiKeyFormModal";
import { useAuth } from "../context";
import type { ApiKey } from "../models/ApiKeys";


export const ApiKeysPage: React.FC = () => {

  const { user, token } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

  useEffect(() => {
    const fetchApiKeys = async () => {
      try {
        if (!user) return;
        const response = await fetch(`${import.meta.env.VITE_APP_DESIGNER_BACKEND}/api/v1/users/apikeys`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });
        if (!response.ok) throw new Error("Error fetching API Keys");
        const data = await response.json();
        setApiKeys(data);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load API Keys");
      }
    };
    fetchApiKeys();
  }, [user, token]);

  // Estados Formulario (ahora Modal)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);

  // Estados Modal Borrado
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null);

  // --- Handlers ---
  const handleCopyKey = (keyString: string) => {
    navigator.clipboard.writeText(keyString);
    toast.success("API Key copied to clipboard!");
  };
  const openCreateModal = () => {
    setFormMode("create");
    setSelectedKey(null);
    setIsFormModalOpen(true);
  };

  const openEditModal = (key: ApiKey) => {
    setFormMode("edit");
    setSelectedKey(key);
    setIsFormModalOpen(true);
  };

  const handleSaveKey = async (formData: Partial<ApiKey>) => {
    try {
      const isCreate = formMode === "create";
      const baseUrl = `${import.meta.env.VITE_APP_DESIGNER_BACKEND}/api/v1/users/apikeys`;
      const url = isCreate ? baseUrl : `${baseUrl}/${selectedKey?.id}`;
      const method = isCreate ? "POST" : "PUT";

      console.log('Saving API Key with data:', formData); // Debug log
      console.log('Request URL:', url, 'Method:', method); // Debug log
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Error saving API Key");
      }

      // Asumimos que el backend devuelve la ApiKey guardada/actualizada
      const savedKey: ApiKey = await response.json();

      setApiKeys((prev) => {
        if (isCreate) {
          return [...prev, savedKey];
        } else {
          return prev.map((key) => (key.id === savedKey.id ? savedKey : key));
        }
      });

      toast.success(isCreate ? "API Key created successfully!" : "API Key updated!");
      setIsFormModalOpen(false);

    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to save API Key");
      // Lanzamos el error para que el modal sepa que falló (y no cierre o pare el loading)
      throw err;
    }
  };
  const confirmDelete = async () => {
    if (!keyToDelete) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_APP_DESIGNER_BACKEND}/api/v1/users/apikeys/${keyToDelete.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Error deleting API Key");
      }
      setApiKeys(apiKeys.filter((k) => k.id !== keyToDelete.id));
      toast.success("API Key deleted successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to delete API Key");
    } finally {
      setIsDeleteModalOpen(false);
      setKeyToDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <ToastContainer position="bottom-right" />

      {/* Contenido Principal */}
      <div className="max-w-6xl mx-auto p-6">
        {/* Cabecera */}
        <div className="flex items-center justify-between mb-8 mt-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">My API Keys</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage your model configurations and programmatic access keys.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add New Key
          </button>
        </div>

        {/* Grid de Tarjetas*/}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {apiKeys.map((key) => (
            <ApiKeyCard
              key={key.id}
              apiKey={key}
              onEdit={() => openEditModal(key)}
              onDelete={() => { setKeyToDelete(key); setIsDeleteModalOpen(true); }}
              onCopy={handleCopyKey}
            />
          ))}
        </div>
      </div>

      {/* --- MODAL FORMULARIO (Creación / Edición) --- */}
      <ApiKeyFormModal
        isOpen={isFormModalOpen}
        mode={formMode}
        selectedKey={selectedKey}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveKey}
      />

      {/* --- MODAL DE ELIMINACIÓN --- */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden transform transition-all">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Delete API Key?</h3>
                <button onClick={() => setIsDeleteModalOpen(false)} className="text-gray-400 hover:text-gray-500"><XMarkIcon className="h-5 w-5" /></button>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete the key <span className="font-semibold text-gray-800">"{keyToDelete?.description}"</span>?
                This action cannot be undone and any application using this key will stop working immediately.
              </p>

              <div className="flex justify-end space-x-3 mt-6">
                <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">Cancel</button>
                <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};