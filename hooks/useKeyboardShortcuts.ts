import { useEffect } from 'react';

interface KeyboardShortcutsProps {
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  enabled: boolean;
}

export const useKeyboardShortcuts = ({ onPlayPause, onSeek, enabled }: KeyboardShortcutsProps) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          onPlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onSeek(-5); // Seek back 5s
          break;
        case 'ArrowRight':
          e.preventDefault();
          onSeek(5); // Seek forward 5s
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onPlayPause, onSeek]);
};
