// Keyboard shortcuts hook for enhanced navigation and actions

'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/app/components/ThemeProvider';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: (event?: KeyboardEvent) => void;
  description: string;
  category: string;
}

interface UseKeyboardShortcutsOptions {
  enableGlobalShortcuts?: boolean;
  shortcuts?: KeyboardShortcut[];
}

export function useKeyboardShortcuts({
  enableGlobalShortcuts = true,
  shortcuts = [],
}: UseKeyboardShortcutsOptions = {}) {
  const router = useRouter();
  const { toggleTheme } = useTheme();

  // Combine default and custom shortcuts
  const allShortcuts = useMemo(() => {
    // Default global shortcuts
    const defaultShortcuts: KeyboardShortcut[] = [
      {
        key: 'h',
        altKey: true,
        action: () => router.push('/'),
        description: 'Go to Home',
        category: 'Navigation',
      },
      {
        key: 'd',
        ctrlKey: true,
        action: (event?: KeyboardEvent) => {
          event?.preventDefault();
          toggleTheme();
        },
        description: 'Toggle Dark Mode',
        category: 'Interface',
      },
      {
        key: 'k',
        ctrlKey: true,
        action: (event?: KeyboardEvent) => {
          event?.preventDefault();
          // Focus search input if available
          const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        },
        description: 'Focus Search',
        category: 'Navigation',
      },
      {
        key: 'n',
        ctrlKey: true,
        shiftKey: true,
        action: (event?: KeyboardEvent) => {
          event?.preventDefault();
          // Trigger new webhook creation
          const createButton = document.querySelector('[data-create-webhook]') as HTMLButtonElement;
          if (createButton) {
            createButton.click();
          }
        },
        description: 'Create New Webhook',
        category: 'Actions',
      },
      {
        key: 'r',
        ctrlKey: true,
        shiftKey: true,
        action: (event?: KeyboardEvent) => {
          event?.preventDefault();
          // Trigger refresh action
          const refreshButton = document.querySelector('[data-refresh]') as HTMLButtonElement;
          if (refreshButton) {
            refreshButton.click();
          } else {
            window.location.reload();
          }
        },
        description: 'Refresh Data',
        category: 'Actions',
      },
      {
        key: 'Escape',
        action: () => {
          // Close any open modals or dropdowns
          const closeButtons = document.querySelectorAll('[data-close], [aria-label="Close"]');
          if (closeButtons.length > 0) {
            const lastButton = closeButtons[closeButtons.length - 1] as HTMLButtonElement;
            lastButton.click();
          }
          
          // Remove focus from active element
          if (document.activeElement && document.activeElement !== document.body) {
            (document.activeElement as HTMLElement).blur();
          }
        },
        description: 'Close Modal/Clear Focus',
        category: 'Interface',
      },
      {
        key: '?',
        shiftKey: true,
        action: () => {
          showShortcutsHelp();
        },
        description: 'Show Keyboard Shortcuts',
        category: 'Help',
      },
    ];

    return enableGlobalShortcuts 
      ? [...defaultShortcuts, ...shortcuts]
      : shortcuts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableGlobalShortcuts, shortcuts, router, toggleTheme]);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement ||
      (event.target as HTMLElement)?.contentEditable === 'true'
    ) {
      // Allow some shortcuts in inputs (like Ctrl+D for theme toggle)
      const allowedInInputs = ['d'];
      if (!allowedInInputs.includes(event.key.toLowerCase()) || !event.ctrlKey) {
        return;
      }
    }

    // Find matching shortcut
    const matchingShortcut = allShortcuts.find(shortcut => {
      const keyMatches = shortcut.key.toLowerCase() === event.key.toLowerCase();
      const ctrlMatches = !!shortcut.ctrlKey === event.ctrlKey;
      const metaMatches = !!shortcut.metaKey === event.metaKey;
      const shiftMatches = !!shortcut.shiftKey === event.shiftKey;
      const altMatches = !!shortcut.altKey === event.altKey;

      return keyMatches && ctrlMatches && metaMatches && shiftMatches && altMatches;
    });

    if (matchingShortcut) {
      event.preventDefault();
      matchingShortcut.action(event);
    }
  }, [allShortcuts]);

  // Show shortcuts help modal
  const showShortcutsHelp = useCallback(() => {
    const helpContent = generateShortcutsHelp(allShortcuts);
    showModal('Keyboard Shortcuts', helpContent);
  }, [allShortcuts]);

  // Add event listener
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown]);

  return {
    shortcuts: allShortcuts,
    showShortcutsHelp,
  };
}

// Generate shortcuts help content
function generateShortcutsHelp(shortcuts: KeyboardShortcut[]): string {
  const categories = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  let html = '<div class="space-y-6">';
  
  Object.entries(categories).forEach(([category, categoryShortcuts]) => {
    html += `<div class="space-y-2">`;
    html += `<h3 class="text-lg font-medium text-gray-900 dark:text-white">${category}</h3>`;
    html += `<div class="space-y-1">`;
    
    categoryShortcuts.forEach(shortcut => {
      const keys = [];
      if (shortcut.ctrlKey) keys.push('Ctrl');
      if (shortcut.metaKey) keys.push('Cmd');
      if (shortcut.shiftKey) keys.push('Shift');
      if (shortcut.altKey) keys.push('Alt');
      keys.push(shortcut.key.toUpperCase());
      
      const keyCombo = keys.join(' + ');
      
      html += `<div class="flex justify-between items-center py-1">`;
      html += `<span class="text-sm text-gray-600 dark:text-gray-300">${shortcut.description}</span>`;
      html += `<kbd class="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-800 rounded border">${keyCombo}</kbd>`;
      html += `</div>`;
    });
    
    html += `</div></div>`;
  });
  
  html += '</div>';
  return html;
}

// Simple modal function (can be replaced with proper modal component)
function showModal(title: string, content: string) {
  // Create modal backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'fixed inset-0 z-50 overflow-y-auto';
  backdrop.innerHTML = `
    <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
      <div class="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" data-close></div>
      <div class="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-lg">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">${title}</h3>
          <button data-close class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div class="text-sm text-gray-600 dark:text-gray-300">
          ${content}
        </div>
        <div class="mt-6 flex justify-end">
          <button data-close class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  `;

  // Add close event listeners
  const closeElements = backdrop.querySelectorAll('[data-close]');
  closeElements.forEach(element => {
    element.addEventListener('click', () => {
      document.body.removeChild(backdrop);
    });
  });

  // Add to DOM
  document.body.appendChild(backdrop);
}

// Hook for component-specific shortcuts
export function useComponentShortcuts(shortcuts: KeyboardShortcut[]) {
  return useKeyboardShortcuts({
    enableGlobalShortcuts: false,
    shortcuts,
  });
} 