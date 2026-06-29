import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { X } from "lucide-react";

interface MediaViewerContextType {
  open: (url: string) => void;
  close: () => void;
}

const MediaViewerContext = createContext<MediaViewerContextType | undefined>(undefined);

export function useMediaViewer() {
  const context = useContext(MediaViewerContext);
  if (!context) {
    throw new Error("useMediaViewer must be used within a MediaViewerProvider");
  }
  return context;
}

export function MediaViewerProvider({ children }: { children: ReactNode }) {
  const [url, setUrl] = useState<string | null>(null);

  const open = useCallback((mediaUrl: string) => {
    setUrl(mediaUrl);
  }, []);

  const close = useCallback(() => {
    setUrl(null);
  }, []);

  return (
    <MediaViewerContext.Provider value={{ open, close }}>
      {children}
      {url && (
        <div className="fixed inset-0 z-50 bg-black" onClick={close}>
          <button
            className="absolute top-4 right-4 text-white z-10 p-2"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
          >
            <X className="h-8 w-8" />
          </button>
          <div className="flex items-center justify-center h-full w-full">
            <img
              src={url}
              alt="Full size"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </MediaViewerContext.Provider>
  );
}
