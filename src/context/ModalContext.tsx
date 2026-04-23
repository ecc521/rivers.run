import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { PromptModal } from '../components/PromptModal';

type ModalContextType = {
  alert: (message: string, title?: string) => Promise<void>;
  confirm: (message: string, title?: string) => Promise<boolean>;
  prompt: (message: string, title?: string) => Promise<string | null>;
  promptEmail: (message: string, title?: string) => Promise<{ subject: string, body: string } | null>;
  resolveSuggestion: (message: string, title?: string, isAnonymous?: boolean) => Promise<{ confirmed: boolean, reason: string, notify: boolean } | null>;
};

export const ModalContext = createContext<ModalContextType>({} as any);

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isAlert: boolean;
    isPrompt: boolean;
    isEmail: boolean;
    isResolution: boolean;
    isAnonymous?: boolean;
    resolve: (value: any) => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    isAlert: false,
    isPrompt: false,
    isEmail: false,
    isResolution: false,
    isAnonymous: false,
    resolve: () => {},
  });

  const alert = useCallback((message: string, title: string = "Alert") => {
    return new Promise<void>((resolve) => {
      setModalState({ isOpen: true, title, message, isAlert: true, isPrompt: false, isEmail: false, isResolution: false, resolve });
    });
  }, []);

  const confirm = useCallback((message: string, title: string = "Confirm") => {
    return new Promise<boolean>((resolve) => {
      setModalState({ isOpen: true, title, message, isAlert: false, isPrompt: false, isEmail: false, isResolution: false, resolve });
    });
  }, []);

  const prompt = useCallback((message: string, title: string = "Input Required") => {
    return new Promise<string | null>((resolve) => {
      setModalState({ isOpen: true, title, message, isAlert: false, isPrompt: true, isEmail: false, isResolution: false, resolve });
    });
  }, []);

  const promptEmail = useCallback((message: string, title: string = "Compose Email") => {
    return new Promise<{ subject: string, body: string } | null>((resolve) => {
      setModalState({ isOpen: true, title, message, isAlert: false, isPrompt: false, isEmail: true, isResolution: false, resolve });
    });
  }, []);

  const resolveSuggestion = useCallback((message: string, title: string = "Resolve Suggestion", isAnonymous: boolean = false) => {
    return new Promise<{ confirmed: boolean, reason: string, notify: boolean } | null>((resolve) => {
      setModalState({ isOpen: true, title, message, isAlert: false, isPrompt: false, isEmail: false, isResolution: true, isAnonymous, resolve });
    });
  }, []);

  const handleConfirm = (val?: string, notify?: boolean) => {
    if (modalState.isAlert) {
      modalState.resolve(undefined);
    } else if (modalState.isPrompt) {
      modalState.resolve(val || "");
    } else if (modalState.isEmail) {
      modalState.resolve(val);
    } else if (modalState.isResolution) {
      modalState.resolve({ confirmed: true, reason: val || "", notify: !!notify });
    } else {
      modalState.resolve(true);
    }
    setModalState(s => ({ ...s, isOpen: false }));
  };

  const handleCancel = () => {
    if (modalState.isAlert) {
      modalState.resolve(undefined);
    } else if (modalState.isPrompt || modalState.isResolution || modalState.isEmail) {
      modalState.resolve(null);
    } else {
      modalState.resolve(false);
    }
    setModalState(s => ({ ...s, isOpen: false }));
  };

  return (
    <ModalContext.Provider value={{ alert, confirm, prompt, promptEmail, resolveSuggestion }}>
      {children}
      <PromptModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        isAlert={modalState.isAlert}
        isPrompt={modalState.isPrompt}
        isEmail={modalState.isEmail}
        isResolution={modalState.isResolution}
        isAnonymous={modalState.isAnonymous}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ModalContext.Provider>
  );
};

export const useModal = () => useContext(ModalContext);
