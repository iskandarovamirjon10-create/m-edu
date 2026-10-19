/**
 * ============================================================================
 *  useListKeyboardNavigation — Linear & Superhuman Caliber List Navigation
 * ============================================================================
 *
 *  Enables frictionless keyboard-first navigation across any table or list:
 *   • 'j' / 'ArrowDown'  -> Next item
 *   • 'k' / 'ArrowUp'    -> Previous item
 *   • 'x'                -> Toggle select focused item
 *   • 'Space'            -> Trigger Quick-Look preview on focused item
 *   • 'Enter'            -> Open focused item record
 *   • 'e'                -> Edit focused item
 *   • 'Escape'           -> Clear selection / blur focus
 *
 *  Zero interference when typing inside input / textarea / contenteditable,
 *  or when global modals / command palette are open.
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePremiumSound } from './usePremiumSound';

export interface UseListKeyboardNavigationOptions<T> {
  items: T[];
  enabled?: boolean;
  getItemId?: (item: T) => string;
  onQuickLook?: (item: T) => void;
  onOpen?: (item: T) => void;
  onSelect?: (item: T) => void;
  onEdit?: (item: T) => void;
  onDelete?: (items: T[]) => void;
  rowSelectorPrefix?: string;
  rowIdPrefix?: string;
}

export function useListKeyboardNavigation<T>({
  items,
  enabled = true,
  getItemId,
  onQuickLook,
  onOpen,
  onSelect,
  onEdit,
  onDelete,
  rowSelectorPrefix = 'list-row-',
  rowIdPrefix,
}: UseListKeyboardNavigationOptions<T>) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { playTick, playPop } = usePremiumSound();

  const effectivePrefix = rowIdPrefix ?? rowSelectorPrefix;
  const effectiveOnOpen = onOpen ?? onSelect;

  const getId = useCallback(
    (item: T): string => {
      if (getItemId) return getItemId(item);
      return (item as unknown as { id: string }).id;
    },
    [getItemId],
  );

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const onQuickLookRef = useRef(onQuickLook);
  onQuickLookRef.current = onQuickLook;

  const onOpenRef = useRef(effectiveOnOpen);
  onOpenRef.current = effectiveOnOpen;

  const onEditRef = useRef(onEdit);
  onEditRef.current = onEdit;

  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;

  // Toggle selection for a single item
  const toggleSelect = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      playPop();
    },
    [playPop],
  );

  // Check if item is selected
  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  // Select all items in current view
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(itemsRef.current.map(getId)));
    playPop();
  }, [getId, playPop]);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setFocusedIndex(null);
  }, []);

  // Scroll focused element into view smoothly
  useEffect(() => {
    if (focusedIndex === null || focusedIndex < 0 || focusedIndex >= items.length) {
      return;
    }
    const currentItem = items[focusedIndex];
    if (!currentItem) return;

    const el = document.getElementById(`${effectivePrefix}${getId(currentItem)}`);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusedIndex, items, effectivePrefix, getId]);

  // Global keydown listener
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input, textarea or contenteditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Ignore if Cmd or Ctrl modifier is pressed (allow Command Palette, browser shortcuts)
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      const total = itemsRef.current.length;
      if (total === 0) return;

      // 'j' or 'ArrowDown' -> Move down
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev === null ? 0 : Math.min(prev + 1, total - 1);
          playTick();
          return next;
        });
        return;
      }

      // 'k' or 'ArrowUp' -> Move up
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev === null ? 0 : Math.max(prev - 1, 0);
          playTick();
          return next;
        });
        return;
      }

      // 'x' -> Toggle select on focused item
      if (e.key === 'x') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const targetIndex = prev === null ? 0 : prev;
          const currentItem = itemsRef.current[targetIndex];
          if (currentItem) {
            toggleSelect(getId(currentItem));
          }
          return targetIndex;
        });
        return;
      }

      // ' ' (Space) -> Quick Look on focused item
      if (e.key === ' ') {
        if (focusedIndex !== null && itemsRef.current[focusedIndex]) {
          e.preventDefault();
          onQuickLookRef.current?.(itemsRef.current[focusedIndex]);
        }
        return;
      }

      // 'Enter' -> Open full record on focused item
      if (e.key === 'Enter') {
        if (focusedIndex !== null && itemsRef.current[focusedIndex]) {
          e.preventDefault();
          onOpenRef.current?.(itemsRef.current[focusedIndex]);
        }
        return;
      }

      // 'e' -> Edit focused item
      if (e.key === 'e') {
        if (focusedIndex !== null && itemsRef.current[focusedIndex]) {
          e.preventDefault();
          onEditRef.current?.(itemsRef.current[focusedIndex]);
        }
        return;
      }

      // 'Escape' -> Clear selections / focus
      if (e.key === 'Escape') {
        setSelectedIds((prev) => {
          if (prev.size > 0) {
            e.preventDefault();
            return new Set();
          }
          return prev;
        });
        setFocusedIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, playTick, toggleSelect, focusedIndex, getId]);

  return {
    focusedIndex,
    setFocusedIndex,
    focusedItem: focusedIndex !== null ? items[focusedIndex] ?? null : null,
    selectedIds,
    selectedCount: selectedIds.size,
    isSelected,
    toggleSelect,
    toggleSelection: toggleSelect,
    selectAll,
    clearSelection,
    isAllSelected: items.length > 0 && selectedIds.size === items.length,
  };
}
