import { useEffect } from 'react';

interface KeyboardShortcutsProps {
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSetStart?: () => void;
  onSetEnd?: () => void;
  onPrevSub?: () => void;
  onNextSub?: () => void;
  enabled: boolean;
}

export const useKeyboardShortcuts = ({ 
  onPlayPause, 
  onSeek, 
  onUndo, 
  onRedo,
  onSetStart,
  onSetEnd,
  onPrevSub,
  onNextSub,
  enabled 
}: KeyboardShortcutsProps) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo?.();
        } else {
          onUndo?.();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
        e.preventDefault();
        onRedo?.();
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
        case 'BracketLeft': // [
          e.preventDefault();
          onSetStart?.();
          break;
        case 'BracketRight': // ]
          e.preventDefault();
          onSetEnd?.();
          break;
        case 'ArrowUp':
          e.preventDefault();
          onPrevSub?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          onNextSub?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onPlayPause, onSeek, onUndo, onRedo, onSetStart, onSetEnd, onPrevSub, onNextSub]);
};
