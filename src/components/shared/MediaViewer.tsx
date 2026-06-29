import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Modal, View, Image, TouchableOpacity, StyleSheet } from "react-native";
import { X } from "lucide-react-native";

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
      <Modal
        visible={!!url}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <TouchableOpacity style={styles.overlay} onPress={close} activeOpacity={1}>
          <View style={styles.container}>
            <TouchableOpacity style={styles.closeButton} onPress={close}>
              <X size={28} color="#FFFFFF" />
            </TouchableOpacity>
            {url && (
              <Image
                source={{ uri: url }}
                style={styles.image}
                resizeMode="contain"
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </MediaViewerContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000000",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    padding: 8,
  },
  image: {
    width: "100%",
    height: "100%",
  },
});