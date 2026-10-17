/**
 * Intégration Android (Capacitor). Toutes les fonctions sont sans effet dans un
 * navigateur : l'application web et l'APK partagent exactement le même code.
 */
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUi } from '../store/ui';
import { downloadBlob } from './download';

export const isNative = Capacitor.isNativePlatform();

export async function initNative(): Promise<void> {
  if (!isNative) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#4C32B8' });
  } catch {
    /* barre de statut non pilotable sur cet appareil */
  }
  // Masque l'écran de démarrage une fois le premier rendu effectué.
  requestAnimationFrame(() => {
    SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => undefined);
  });
}

/**
 * Bouton Retour Android, du plus local au plus global : fenêtre ouverte,
 * recherche, menu, page précédente, puis mise en arrière-plan sur l'accueil.
 */
export function useAndroidBackButton(): void {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (!isNative) return;
    const handle = CapApp.addListener('backButton', ({ canGoBack }) => {
      const ui = useUi.getState();
      if (ui.modal) return ui.closeModal();
      if (ui.searchOpen) return ui.setSearchOpen(false);
      if (ui.moreOpen) return ui.setMoreOpen(false);
      if (document.querySelector('[role="dialog"]')) {
        // Les fenêtres locales des pages se ferment sur Échap.
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return;
      }
      if (location.pathname !== '/') {
        if (canGoBack && window.history.length > 1) navigate(-1);
        else navigate('/', { replace: true });
        return;
      }
      void CapApp.minimizeApp();
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, [navigate, location.pathname]);
}

export interface SaveResult {
  ok: boolean;
  message: string;
}

/** Enregistre un fichier : Documents/VIOLETBANK sur Android, téléchargement dans un navigateur. */
export async function saveFile(filename: string, content: string, mime: string): Promise<SaveResult> {
  if (!isNative) {
    downloadBlob(filename, content, mime);
    return { ok: true, message: `Fichier « ${filename} » téléchargé.` };
  }
  try {
    await Filesystem.writeFile({ path: `VIOLETBANK/${filename}`, data: content, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
    return { ok: true, message: `Enregistré dans Documents/VIOLETBANK/${filename}` };
  } catch (e) {
    return { ok: false, message: `Enregistrement impossible : ${(e as Error).message}` };
  }
}

/** Enregistre puis informe l'utilisateur de l'emplacement du fichier. */
export async function exportFile(filename: string, content: string, mime: string): Promise<void> {
  const res = await saveFile(filename, content, mime);
  useUi.getState().toast(res.ok ? 'success' : 'error', res.ok ? 'Fichier enregistré' : 'Export impossible', res.message);
}
