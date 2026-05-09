import React from "react";


interface UnsavedChangesModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onProceedWithoutSaving: () => void;
  onConfirmSaveAndProceed: () => void;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  onCancel,
  onProceedWithoutSaving,
  onConfirmSaveAndProceed,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-2">Unsaved Changes</h2>
        <p className="text-sm text-gray-600 mb-6">
          You have unsaved changes in your Leia configurations. Do you want to save them before proceeding?
        </p>
        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onProceedWithoutSaving}
            className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors text-sm"
          >
            No, proceed without saving
          </button>
          <button
            onClick={onConfirmSaveAndProceed}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
          >
            Yes, save and proceed
          </button>
        </div>
      </div>
    </div>
  );
};