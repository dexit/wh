// Component to display detailed information about a single request

'use client';

import { useState, useMemo } from 'react';
import { formatDateTime, formatBytes, getContentTypeName, copyToClipboard, prettifyJson } from '@/lib/utils';
import { Button } from './Layout';
import { useRequestNotes } from '@/hooks/useRequestNotes';
import NoteEditModal from './NoteEditModal';
import type { WebhookRequest } from '@/types/webhook';

interface RequestDetailProps {
  request: WebhookRequest;
  onClose: () => void;
  isInline?: boolean;
  onNoteChange?: () => void; // Callback when note is saved/deleted
}

export default function RequestDetail({ request, onClose, isInline = false, onNoteChange }: RequestDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'headers' | 'body' | 'raw'>('overview');
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const { saveNote, deleteNote, getNote } = useRequestNotes(request.webhookId);
  
  // Memoize the stable request ID and webhook ID to prevent unnecessary effects
  const stableRequestId = useMemo(() => request.id, [request.id]);
  const stableWebhookId = useMemo(() => request.webhookId, [request.webhookId]);
  
  // Get current note
  const currentNoteData = getNote(stableRequestId);
  const currentNote = currentNoteData?.note || '';

  // Handle copy to clipboard
  const handleCopy = async (text: string, label: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopySuccess(label);
      setTimeout(() => setCopySuccess(null), 2000);
    }
  };

  // Handle note operations
  const handleNoteSave = (note: string) => {
    if (note) {
      saveNote(stableRequestId, note);
    } else {
      deleteNote(stableRequestId);
    }
    setIsNoteModalOpen(false);
    
    // Notify parent component that note has changed
    if (onNoteChange) {
      onNoteChange();
    }
  };

  const handleNoteDelete = () => {
    deleteNote(stableRequestId);
    setIsNoteModalOpen(false);
    
    // Notify parent component that note has changed
    if (onNoteChange) {
      onNoteChange();
    }
  };

  const handleNoteCancel = () => {
    setIsNoteModalOpen(false);
  };

  // Format body content based on content type
  const formatBody = () => {
    if (!request.body) return 'No body content';
    
    const contentType = request.contentType || '';
    
    if (contentType.includes('application/json')) {
      try {
        return prettifyJson(request.body);
      } catch {
        return request.body;
      }
    }
    
    return request.body;
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'headers', label: 'Headers' },
    { id: 'body', label: 'Body' },
    { id: 'raw', label: 'Raw' },
  ] as const;

  // Content component that can be used in both modes
  const ContentComponent = () => (
    <>
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 relative">
        {!isInline && (
          <button
            onClick={onClose}
            className="absolute top-3 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors z-10"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <nav className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className={`p-6 ${isInline ? 'flex-1 overflow-y-auto' : 'max-h-96 overflow-y-auto'}`}>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Request Information</h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Timestamp</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">{formatDateTime(request.timestamp)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Request ID</dt>
                    <dd className="text-sm text-gray-900 dark:text-white font-mono">
                      #{request.id.split('-')[0]}
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">({request.id})</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Content Type</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">{getContentTypeName(request.contentType || 'unknown')}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Body Size</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">{formatBytes(request.bodySize)}</dd>
                  </div>
                </dl>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Client Information</h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">IP Address</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">{request.ip || 'Unknown'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">User Agent</dt>
                    <dd className="text-sm text-gray-900 dark:text-white break-all">{request.userAgent || 'Unknown'}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Query Parameters */}
            {Object.keys(request.queryParams).length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Query Parameters</h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-4">
                  <dl className="space-y-2">
                    {Object.entries(request.queryParams).map(([key, value]) => (
                      <div key={key} className="flex">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mr-4">{key}:</dt>
                        <dd className="text-sm text-gray-900 dark:text-white break-all">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            )}

            {/* Notes Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes</h3>
                <button
                  onClick={() => setIsNoteModalOpen(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  {currentNote ? 'Edit Note' : 'Add Note'}
                </button>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-3 min-h-[3rem]">
                {currentNote ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                      {currentNote}
                    </p>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {(() => {
                        try {
                          const stored = localStorage.getItem('webhook-request-notes');
                          if (stored) {
                            const allNotes = JSON.parse(stored);
                            const webhookNotes = allNotes[stableWebhookId] || {};
                            const note = webhookNotes[stableRequestId];
                            if (note) {
                              const createdAt = new Date(note.createdAt);
                              const updatedAt = new Date(note.updatedAt);
                              const isUpdated = updatedAt.getTime() !== createdAt.getTime();
                              return isUpdated 
                                ? `Updated ${formatDateTime(updatedAt)}`
                                : `Created ${formatDateTime(createdAt)}`;
                            }
                          }
                        } catch (error) {
                          console.error('Failed to load note timestamp:', error);
                        }
                        return '';
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No notes yet. Click &quot;Add Note&quot; to add your thoughts.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Headers Tab */}
        {activeTab === 'headers' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Request Headers</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(JSON.stringify(request.headers, null, 2), 'headers')}
              >
                {copySuccess === 'headers' ? 'Copied!' : 'Copy All'}
              </Button>
            </div>
            {Object.keys(request.headers).length > 0 ? (
              <div className={`bg-gray-50 dark:bg-gray-700 rounded-md p-4 ${isInline ? 'max-h-full' : 'max-h-64'} overflow-y-auto`}>
                <dl className="space-y-3">
                  {Object.entries(request.headers).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{key}</dt>
                      <dd className="text-sm text-gray-900 dark:text-white break-all mt-1">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">No headers found</p>
              </div>
            )}
          </div>
        )}

        {/* Body Tab */}
        {activeTab === 'body' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Request Body</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(request.body, 'body')}
                disabled={!request.body}
              >
                {copySuccess === 'body' ? 'Copied!' : 'Copy Body'}
              </Button>
            </div>
            <div className={`bg-gray-50 dark:bg-gray-700 rounded-md p-4 ${isInline ? 'max-h-full' : 'max-h-64'} overflow-auto`}>
              <pre className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-all">
                {formatBody()}
              </pre>
            </div>
          </div>
        )}

        {/* Raw Tab */}
        {activeTab === 'raw' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Raw Request Data</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(JSON.stringify(request, null, 2), 'raw')}
              >
                {copySuccess === 'raw' ? 'Copied!' : 'Copy Raw'}
              </Button>
            </div>
            <div className={`bg-gray-50 dark:bg-gray-700 rounded-md p-4 ${isInline ? 'max-h-full' : 'max-h-64'} overflow-auto`}>
              <pre className="text-xs text-gray-900 dark:text-white whitespace-pre-wrap break-all">
                {JSON.stringify(request, null, 2)}
              </pre>
            </div>
          </div>
        )}


      </div>

      {/* Footer - only show in modal mode */}
      {!isInline && (
        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </>
  );

  // Return inline or modal version based on isInline prop
  if (isInline) {
    return (
      <>
        <div className="h-full flex flex-col bg-white dark:bg-gray-800">
          <ContentComponent />
        </div>
        
        <NoteEditModal
          isOpen={isNoteModalOpen}
          note={currentNote}
          onSave={handleNoteSave}
          onCancel={handleNoteCancel}
          onDelete={currentNote ? handleNoteDelete : undefined}
        />
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-full overflow-hidden">
          <ContentComponent />
        </div>
      </div>
      
      <NoteEditModal
        isOpen={isNoteModalOpen}
        note={currentNote}
        onSave={handleNoteSave}
        onCancel={handleNoteCancel}
        onDelete={currentNote ? handleNoteDelete : undefined}
      />
    </>
  );
} 