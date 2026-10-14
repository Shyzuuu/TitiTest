/**
 * Contrat partagé entre l'application et ses panneaux.
 *
 * @typedef {{
 *   lab: import('../app/LabController.js').LabController,
 *   input: import('../input/InputController.js').InputController,
 *   metrics: { fps: number, renderMs: number, drawCount: number },
 *   toast: (level: 'info'|'success'|'warning'|'error', message: string) => void,
 *   onError: (e: unknown) => void,
 *   confirm: (message: string) => Promise<boolean>,
 *   prompt: (message: string, initial?: string) => Promise<string | null>,
 *   refreshLibrary: () => void,
 *   stopRecording: () => Promise<void>,
 *   closePanelOnMobile: () => void,
 *   applyTouchButtons: (on: boolean) => void,
 * }} UiContext
 */

export {};
