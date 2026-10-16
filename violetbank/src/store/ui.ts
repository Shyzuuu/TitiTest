import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';
export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}

export type ModalKind = 'deposit' | 'withdraw' | 'expense' | 'transfer' | 'transaction' | 'quick';
export interface ModalState {
  kind: ModalKind;
  props?: Record<string, string | undefined>;
}

interface UiStore {
  toasts: Toast[];
  modal: ModalState | null;
  moreOpen: boolean;
  searchOpen: boolean;
  toast: (tone: ToastTone, title: string, body?: string) => void;
  dismiss: (id: number) => void;
  openModal: (kind: ModalKind, props?: ModalState['props']) => void;
  closeModal: () => void;
  setMoreOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
}

let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export const useUi = create<UiStore>((set, get) => ({
  toasts: [],
  modal: null,
  moreOpen: false,
  searchOpen: false,
  toast: (tone, title, body) => {
    const id = nextId++;
    // Au plus 4 toasts visibles : les plus anciens cèdent la place.
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, tone, title, body }] }));
    timers.set(id, setTimeout(() => get().dismiss(id), tone === 'error' ? 6500 : 4200));
  },
  dismiss: (id) => {
    const t = timers.get(id);
    if (t) clearTimeout(t);
    timers.delete(id);
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
  },
  openModal: (kind, props) => set({ modal: { kind, props }, moreOpen: false }),
  closeModal: () => set({ modal: null }),
  setMoreOpen: (moreOpen) => set({ moreOpen }),
  setSearchOpen: (searchOpen) => set({ searchOpen, moreOpen: false }),
}));
