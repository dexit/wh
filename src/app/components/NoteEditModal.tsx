// Simple modal component for editing request notes

'use client';

import { useState, useRef, useEffect } from 'react';

interface NoteEditModalProps {
  isOpen: boolean;
  note: string;
  onSave: (note: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export default function NoteEditModal({ isOpen, note, onSave, onCancel, onDelete }: NoteEditModalProps) {
  const [noteText, setNoteText] = useState(note);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset note text when modal opens
  useEffect(() => {
    if (isOpen) {
      setNoteText(note);
      // Focus textarea when modal opens
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen, note]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const modal = document.querySelector('[data-note-modal]');
      if (modal && !modal.contains(e.target as Node)) {
        onCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onCancel]);

  const handleSave = () => {
    onSave(noteText.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      <div data-note-modal className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-200/50 dark:border-gray-700/50 pointer-events-auto">
        <div className="p-5">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a note..."
            className="w-full h-24 px-0 py-0 text-sm border-0 focus:ring-0 placeholder-gray-400 dark:placeholder-gray-500 bg-transparent text-gray-900 dark:text-white resize-none outline-none"
          />

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center space-x-3">
              {note && onDelete && (
                <button
                  onClick={onDelete}
                  className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={onCancel}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 