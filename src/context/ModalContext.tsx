import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { PromptModal } from '../components/PromptModal';

type ModalContextType = {
  alert: (message: string, title?: string) => Promise<void>;
  confirm: (message: string, title?: string) => Promise<boolean>;
  prompt: (message: string, title?: string) => Promise<string | null>;
};

export const ModalContext = createContext<ModalContextType>({} as any);

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isAlert: boolean;
    isPrompt: boolean;
    resolve: (value: any) => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    isAlert: false,
    isPrompt: false,
    resolve: () => {},
  });

  const alert = useCallback((message: string, title: string = "Alert") => {
    return new Promise<void>((resolve) => {
      setModalState({ isOpen: true, title, message, isAlert: true, isPrompt: false, resolve });
    });
  }, []);

  const confirm = useCallback((message: string, title: string = "Confirm") => {
    return new Promise<boolean>((resolve) => {
      setModalState({ isOpen: true, title, message, isAlert: false, isPrompt: false, resolve });
    });
  }, []);

  const prompt = useCallback((message: string, title: string = "Input Required") => {
    return new Promise<string | null>((resolve) => {
      setModalState({ isOpen: true, title, message, isAlert: false, isPrompt: true, resolve });
    });
  }, []);

  const handleConfirm = (val?: string) => {
    if (modalState.isAlert) {
      modalState.resolve(undefined);
    } else if (modalState.isPrompt) {
      modalState.resolve(val || "");
    } else {
      modalState.resolve(true);
    }
    setModalState(s => ({ ...s, isOpen: false }));
  };

  const handleCancel = () => {
    if (modalState.isAlert) {
      modalState.resolve(undefined);
    } else if (modalState.isPrompt) {
      modalState.resolve(null);
    } else {
      modalState.resolve(false);
    }
    setModalState(s => ({ ...s, isOpen: false }));
  };

  return (
    <ModalContext.Provider value={{ alert, confirm, prompt }}>
      {children}
      <PromptModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        isAlert={modalState.isAlert}
        isPrompt={modalState.isPrompt}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ModalContext.Provider>
  );
};

export const useModal = () => useContext(ModalContext);
