import { useState, useCallback } from "react";

export const useUnsavedChanges = (
  getUnsavedItems: () => number[],
  saveItem: (idx: number) => Promise<boolean>
) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    pendingAction: (() => Promise<void> | void) | null;
    unsavedIndices: number[];
  }>({
    isOpen: false,
    pendingAction: null,
    unsavedIndices: [],
  });

  const withUnsavedChangesCheck = useCallback(
    (action: () => Promise<void> | void, specificIndex?: number) => {
      let unsaved = getUnsavedItems();

      if (specificIndex !== undefined) {
        unsaved = unsaved.includes(specificIndex) ? [specificIndex] : [];
      }

      if (unsaved.length > 0) {
        setModalState({
          isOpen: true,
          pendingAction: action,
          unsavedIndices: unsaved,
        });
      } else {
        action();
      }
    },
    [getUnsavedItems]
  );

  const handleConfirmSaveAndProceed = async () => {
    const { pendingAction, unsavedIndices } = modalState;
    setModalState({ isOpen: false, pendingAction: null, unsavedIndices: [] });

    let allSaved = true;
    for (const idx of unsavedIndices) {
      const success = await saveItem(idx);
      if (!success) {
        allSaved = false;
        break;
      }
    }

    if (allSaved && pendingAction) {
      await pendingAction();
    }
  };

  const handleProceedWithoutSaving = async () => {
    const { pendingAction } = modalState;
    setModalState({ isOpen: false, pendingAction: null, unsavedIndices: [] });
    if (pendingAction) {
      await pendingAction();
    }
  };

  const handleCancelUnsavedModal = () => {
    setModalState({ isOpen: false, pendingAction: null, unsavedIndices: [] });
  };

  return {
    isModalOpen: modalState.isOpen,
    withUnsavedChangesCheck,
    handleConfirmSaveAndProceed,
    handleProceedWithoutSaving,
    handleCancelUnsavedModal,
  };
};