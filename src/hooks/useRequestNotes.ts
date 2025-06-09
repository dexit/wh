// Hook for managing request notes stored in localStorage

import { useState, useEffect, useCallback } from 'react';

interface RequestNote {
  requestId: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

interface RequestNotesData {
  [webhookId: string]: {
    [requestId: string]: RequestNote;
  };
}

const STORAGE_KEY = 'webhook-request-notes';

export function useRequestNotes(webhookId: string) {
  const [notes, setNotes] = useState<Record<string, RequestNote>>({});

  // Load notes from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const allNotes: RequestNotesData = JSON.parse(stored);
        const webhookNotes = allNotes[webhookId] || {};
        
        // Convert date strings back to Date objects
        const processedNotes: Record<string, RequestNote> = {};
        Object.entries(webhookNotes).forEach(([requestId, note]) => {
          processedNotes[requestId] = {
            ...note,
            createdAt: new Date(note.createdAt),
            updatedAt: new Date(note.updatedAt),
          };
        });
        
        setNotes(processedNotes);
      }
    } catch (error) {
      console.error('Failed to load request notes from localStorage:', error);
    }
  }, [webhookId]);

  // Save note for a specific request
  const saveNote = useCallback((requestId: string, noteText: string) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const allNotes: RequestNotesData = stored ? JSON.parse(stored) : {};
      
      if (!allNotes[webhookId]) {
        allNotes[webhookId] = {};
      }

      const now = new Date();
      const existingNote = allNotes[webhookId][requestId];
      
      const noteData: RequestNote = {
        requestId,
        note: noteText,
        createdAt: existingNote?.createdAt || now,
        updatedAt: now,
      };

      allNotes[webhookId][requestId] = noteData;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allNotes));
      
      setNotes(prev => ({
        ...prev,
        [requestId]: noteData,
      }));

      return true;
    } catch (error) {
      console.error('Failed to save request note to localStorage:', error);
      return false;
    }
  }, [webhookId]);

  // Delete note for a specific request
  const deleteNote = useCallback((requestId: string) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const allNotes: RequestNotesData = JSON.parse(stored);
        
        if (allNotes[webhookId] && allNotes[webhookId][requestId]) {
          delete allNotes[webhookId][requestId];
          
          // Clean up empty webhook entries
          if (Object.keys(allNotes[webhookId]).length === 0) {
            delete allNotes[webhookId];
          }
          
          localStorage.setItem(STORAGE_KEY, JSON.stringify(allNotes));
          
          setNotes(prev => {
            const newNotes = { ...prev };
            delete newNotes[requestId];
            return newNotes;
          });
        }
      }
      return true;
    } catch (error) {
      console.error('Failed to delete request note from localStorage:', error);
      return false;
    }
  }, [webhookId]);

  // Get note for a specific request
  const getNote = useCallback((requestId: string): RequestNote | null => {
    return notes[requestId] || null;
  }, [notes]);

  // Check if a request has a note
  const hasNote = useCallback((requestId: string): boolean => {
    return Boolean(notes[requestId]?.note);
  }, [notes]);

  // Get all notes for the current webhook
  const getAllNotes = useCallback((): Record<string, RequestNote> => {
    return notes;
  }, [notes]);

  return {
    saveNote,
    deleteNote,
    getNote,
    hasNote,
    getAllNotes,
  };
} 