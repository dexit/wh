// Common utility functions library

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { HttpMethod } from '@/types/webhook';

/**
 * Tailwind CSS class name merge utility
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback UUID v4 implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Generate short ID (for URLs)
 */
export function generateShortId(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Format date time
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

/**
 * Format relative time
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return `${seconds} seconds ago`;
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours < 24) return `${hours} hours ago`;
  if (days < 30) return `${days} days ago`;
  
  return formatDateTime(d);
}

/**
 * Format file size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    }
  } catch (error) {
    console.error('Failed to copy text:', error);
    return false;
  }
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  if (typeof obj === 'object') {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T = unknown>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * Safe JSON stringify
 */
export function safeJsonStringify(obj: unknown, fallback: string = '{}'): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return fallback;
  }
}

/**
 * Get HTTP method color
 */
export function getMethodColor(method: string): string {
  const colors: Record<HttpMethod, string> = {
    GET: 'text-green-600 bg-green-50',
    POST: 'text-blue-600 bg-blue-50',
    PUT: 'text-orange-600 bg-orange-50',
    DELETE: 'text-red-600 bg-red-50',
    PATCH: 'text-purple-600 bg-purple-50',
    HEAD: 'text-gray-600 bg-gray-50',
    OPTIONS: 'text-indigo-600 bg-indigo-50',
  };
  
  return colors[method as HttpMethod] || 'text-gray-600 bg-gray-50';
}

/**
 * Get friendly content type name
 */
export function getContentTypeName(contentType: string): string {
  const types: Record<string, string> = {
    'application/json': 'JSON',
    'application/x-www-form-urlencoded': 'Form Data',
    'multipart/form-data': 'Multipart',
    'text/plain': 'Text',
    'text/html': 'HTML',
    'application/xml': 'XML',
    'text/xml': 'XML',
    'application/octet-stream': 'Binary',
    'image/jpeg': 'JPEG Image',
    'image/png': 'PNG Image',
    'image/gif': 'GIF Image',
    'image/svg+xml': 'SVG Image',
  };
  
  // Check exact match
  if (types[contentType]) return types[contentType];
  
  // Check partial match
  for (const [type, name] of Object.entries(types)) {
    if (contentType.includes(type)) return name;
  }
  
  return contentType || 'Unknown';
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate webhook ID format
 */
export function isValidWebhookId(id: string): boolean {
  return /^[a-zA-Z0-9]{6,12}$/.test(id);
}

/**
 * Prettify JSON string
 */
export function prettifyJson(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

/**
 * Minify JSON string
 */
export function minifyJson(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json));
  } catch {
    return json;
  }
}

/**
 * Get current base URL
 */
export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Client-side: use current origin
    return window.location.origin;
  }
  
  // Server-side: try to get from environment variables or use default
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  if (process.env.NODE_ENV === 'production') {
    return 'https://your-domain.com'; // Replace with your production domain
  }
  
  // Development fallback - try to detect port
  const defaultPort = process.env.PORT || '3000';
  return `http://localhost:${defaultPort}`;
}

/**
 * Generate webhook URL for the given webhook ID
 */
export function generateWebhookUrl(baseUrl: string, webhookId: string): string {
  // Use provided baseUrl or get current base URL
  const finalBaseUrl = baseUrl || getBaseUrl();
  
  try {
    const url = new URL(finalBaseUrl);
    url.pathname = `/api/webhook/${webhookId}`;
    return url.toString();
  } catch (error) {
    // Fallback if URL construction fails
    console.warn('Failed to construct webhook URL:', error);
    const fallbackUrl = getBaseUrl();
    return `${fallbackUrl}/api/webhook/${webhookId}`;
  }
}

/**
 * Extract webhook ID from URL
 */
export function extractWebhookId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const match = urlObj.pathname.match(/^\/w\/([a-zA-Z0-9]+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Check if mobile device
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

/**
 * Get user agent information
 */
export function getUserAgentInfo(userAgent: string): { browser: string; os: string } {
  const ua = userAgent.toLowerCase();
  
  let browser = 'Unknown';
  let os = 'Unknown';
  
  // Detect browser
  if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';
  else if (ua.includes('opera')) browser = 'Opera';
  
  // Detect operating system
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios')) os = 'iOS';
  
  return { browser, os };
}

/**
 * Error handling utility
 */
export function handleError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create cancel token
 */
export function createCancelToken() {
  let cancelled = false;
  return {
    cancel: () => { cancelled = true; },
    isCancelled: () => cancelled,
  };
}

/**
 * Export data to JSON file
 */
export function exportToJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, `${filename}.json`);
}

/**
 * Export data to CSV file
 */
export function exportToCsv(data: Record<string, unknown>[], filename: string, headers?: string[]): void {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Auto-detect headers if not provided
  if (!headers) {
    headers = Object.keys(data[0]);
  }

  // Create CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row => 
      headers!.map(header => {
        const value = row[header];
        // Escape and quote values that contain commas, quotes, or newlines
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value || '';
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Download blob as file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Import data from JSON file
 */
export function importFromJson<T = unknown>(file: File): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        resolve(data);
      } catch {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Calculate storage usage
 */
export function calculateStorageUsage(): {
  used: number;
  total: number;
  percentage: number;
  formatted: {
    used: string;
    total: string;
  };
} {
  if (typeof window === 'undefined') {
    return {
      used: 0,
      total: 0,
      percentage: 0,
      formatted: { used: '0 B', total: '0 B' }
    };
  }

  try {
    // Estimate localStorage usage
    let used = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        used += localStorage[key].length + key.length;
      }
    }

    // Most browsers have 5-10MB limit for localStorage
    const total = 5 * 1024 * 1024; // 5MB
    const percentage = (used / total) * 100;

    return {
      used,
      total,
      percentage,
      formatted: {
        used: formatBytes(used),
        total: formatBytes(total)
      }
    };
  } catch (error) {
    console.error('Failed to calculate storage usage:', error);
    return {
      used: 0,
      total: 0,
      percentage: 0,
      formatted: { used: '0 B', total: '0 B' }
    };
  }
} 