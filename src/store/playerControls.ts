/**
 * Exposes the playback controls that already exist in player.tsx (the native
 * <video> element, fullscreen toggle, chat/gift panel openers, reactions
 * visibility) to code outside the player screen — specifically the AI
 * assistant overlay, which is mounted once in _app.tsx and has no direct
 * access to player.tsx's local state/refs. player.tsx registers these on
 * mount and clears them on unmount; nothing here adds a new playback
 * capability, it only makes the existing ones reachable.
 */
import { create } from 'zustand';

type PlayerControlsState = {
    video: HTMLVideoElement | null;
    toggleFullscreen: (() => void) | null;
    openChat: (() => void) | null;
    openGift: (() => void) | null;
    toggleReactions: (() => void) | null;
    register: (controls: Omit<PlayerControlsState, 'register' | 'clear'>) => void;
    clear: () => void;
};

export const usePlayerControls = create<PlayerControlsState>((set) => ({
    video: null,
    toggleFullscreen: null,
    openChat: null,
    openGift: null,
    toggleReactions: null,
    register: (controls) => set(controls),
    clear: () =>
        set({
            video: null,
            toggleFullscreen: null,
            openChat: null,
            openGift: null,
            toggleReactions: null,
        }),
}));
