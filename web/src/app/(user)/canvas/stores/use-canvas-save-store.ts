import { create } from "zustand";

export type CanvasSaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

type CanvasSaveStore = {
    status: CanvasSaveStatus;
    lastSavedAt: number | null;
    markDirty: () => void;
    markSaving: () => void;
    markSaved: () => void;
    markError: () => void;
};

export const useCanvasSaveStore = create<CanvasSaveStore>((set) => ({
    status: "idle",
    lastSavedAt: null,
    markDirty: () => set((state) => (state.status === "saving" ? state : { status: "dirty" })),
    markSaving: () => set({ status: "saving" }),
    markSaved: () => set({ status: "saved", lastSavedAt: Date.now() }),
    markError: () => set({ status: "error" }),
}));
