/**
 * Global state for the AI assistant overlay (zustand). The overlay itself is
 * mounted once in _app.tsx so it's reachable from every screen; the mic
 * button lives in Navbar.tsx, which is rendered per-page — this store is the
 * channel between the two, same pattern as playerControls.ts.
 */
import { create } from 'zustand';
import type { TvVideo } from '../api/catalog';

export type AssistantMessage = {
    role: 'user' | 'assistant';
    text: string;
};

export type AssistantAction = {
    type:
        | 'navigate_home'
        | 'navigate_events'
        | 'navigate_search'
        | 'navigate_my_list'
        | 'navigate_detail'
        | 'navigate_player'
        | 'play'
        | 'pause'
        | 'mute'
        | 'unmute'
        | 'toggle_fullscreen'
        | 'open_chat'
        | 'open_gift'
        | 'toggle_reactions';
    eventId?: string;
};

type AssistantState = {
    open: boolean;
    messages: AssistantMessage[];
    results: TvVideo[];
    loading: boolean;
    openOverlay: () => void;
    closeOverlay: () => void;
    pushMessage: (message: AssistantMessage) => void;
    setResults: (results: TvVideo[]) => void;
    setLoading: (loading: boolean) => void;
    reset: () => void;
};

export const useAssistant = create<AssistantState>((set) => ({
    open: false,
    messages: [],
    results: [],
    loading: false,
    openOverlay: () => set({ open: true }),
    closeOverlay: () => set({ open: false }),
    pushMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
    setResults: (results) => set({ results }),
    setLoading: (loading) => set({ loading }),
    reset: () => set({ messages: [], results: [], loading: false }),
}));
