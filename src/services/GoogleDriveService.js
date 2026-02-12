/**
 * GoogleDriveService - Handles Google OAuth 2.0 and Google Drive file operations
 *
 * Uses Google Identity Services (GIS) for OAuth token-based auth.
 *
 * Scopes:
 *   - https://www.googleapis.com/auth/drive.readonly (read-only access to Drive files)
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '803815610394-q9jiico10t5obbv9tdib05akm0f8vemr.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';
const SHARED_FOLDER_ID = import.meta.env.VITE_GOOGLE_SHARED_FOLDER_ID || '1OZXQcKjsZY59gnPFDThSZehJzxsvtjPU';

// Security: Maximum file size for downloads (50MB)
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// Security: Allowed MIME types for file operations
const ALLOWED_MIME_TYPES = Object.freeze([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
]);

export { CLIENT_ID };

let tokenClient = null;
let accessToken = null;
let tokenExpiresAt = null; // Track token expiration

/**
 * Load the Google Identity Services script dynamically
 */
function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

/**
 * Initialize the OAuth token client and trigger the consent flow.
 * Returns an access token upon successful login.
 *
 * @returns {Promise<string>} access token
 */
function buildOriginMismatchError(origin) {
  return new Error(
    `redirect_uri_mismatch: The origin ${origin} is not registered for this OAuth client.\n\n` +
    `To fix this, open the Google Cloud Console → APIs & Credentials → OAuth 2.0 Client IDs, ` +
    `select client ${CLIENT_ID}, and add ${origin} to "Authorized JavaScript Origins".`
  );
}

export async function signInWithGoogle() {
  await loadGisScript();

  return new Promise((resolve, reject) => {
    try {
      const origin = window.location.origin;
      let popupOpenedAt = Date.now();

      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        ux_mode: 'popup',
        callback: (response) => {
          if (response.error) {
            if (response.error === 'redirect_uri_mismatch' ||
                response.error === 'invalid_request' ||
                (response.error_description && response.error_description.includes('redirect_uri_mismatch'))) {
              reject(buildOriginMismatchError(origin));
              return;
            }
            reject(new Error(response.error_description || response.error));
            return;
          }
          accessToken = response.access_token;
          // Track token expiration (expires_in is in seconds)
          if (response.expires_in) {
            tokenExpiresAt = Date.now() + (response.expires_in * 1000) - 60000; // 1 min buffer
          } else {
            tokenExpiresAt = Date.now() + 3600000; // Default 1 hour
          }
          resolve(accessToken);
        },
        error_callback: (err) => {
          if (err.type === 'popup_failed_to_open') {
            reject(new Error(
              'Could not open sign-in popup. Please allow popups for this site and try again.'
            ));
          } else if (err.type === 'popup_closed') {
            // If the popup closed very quickly, it likely showed an error page
            // (e.g. redirect_uri_mismatch) that the user had to dismiss.
            const elapsed = Date.now() - popupOpenedAt;
            if (elapsed < 3000) {
              reject(buildOriginMismatchError(origin));
            } else {
              reject(new Error('Sign-in popup was closed before completing authentication.'));
            }
          } else {
            reject(new Error(
              `OAuth error: ${err.message || err.type || 'unknown'}. ` +
              `If you see "redirect_uri_mismatch", add ${origin} to Authorized JavaScript Origins ` +
              `in the Google Cloud Console for OAuth client ${CLIENT_ID}.`
            ));
          }
        },
      });
      popupOpenedAt = Date.now();
      tokenClient.requestAccessToken({ prompt: '' });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Check if we currently have a valid access token
 */
export function isSignedIn() {
  // Check both token existence and expiration
  if (!accessToken) return false;
  if (tokenExpiresAt && Date.now() > tokenExpiresAt) {
    // Token expired, clear it
    accessToken = null;
    tokenExpiresAt = null;
    return false;
  }
  return true;
}

/**
 * Check if token is expired or will expire soon
 */
export function isTokenExpired() {
  if (!accessToken || !tokenExpiresAt) return true;
  return Date.now() > tokenExpiresAt;
}

/**
 * Sign out / revoke the current token
 */
export function signOut() {
  if (accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken);
  }
  accessToken = null;
  tokenClient = null;
  tokenExpiresAt = null;
}

/**
 * Validate file ID format to prevent injection
 * Google Drive file IDs are alphanumeric with hyphens and underscores
 */
function isValidFileId(fileId) {
  if (!fileId || typeof fileId !== 'string') return false;
  // Google Drive IDs are typically 28-44 characters, alphanumeric with - and _
  return /^[a-zA-Z0-9_-]{10,100}$/.test(fileId);
}

/**
 * Sanitize search query to prevent query injection
 */
function sanitizeSearchQuery(query) {
  if (!query || typeof query !== 'string') return '';
  // Remove potentially dangerous characters, keep alphanumeric, spaces, and common punctuation
  return query
    .trim()
    .slice(0, 100) // Limit length
    .replace(/[^\w\s.-]/g, '') // Only allow word chars, spaces, dots, hyphens
    .replace(/'/g, "\\'"); // Escape quotes
}

/**
 * List xlsx files from the shared Google Drive folder.
 * Supports pagination via pageToken.
 *
 * @param {Object} options
 * @param {string} [options.pageToken] - token for next page
 * @param {number} [options.pageSize=100] - results per page
 * @param {string} [options.searchQuery] - optional name filter
 * @returns {Promise<{files: Array, nextPageToken: string|null}>}
 */
export async function listXlsxFiles({ pageToken, pageSize = 100, searchQuery } = {}) {
  // Security: Check token validity
  if (!accessToken) {
    throw new Error('Not signed in. Please sign in with Google first.');
  }
  
  if (isTokenExpired()) {
    accessToken = null;
    tokenExpiresAt = null;
    throw new Error('Session expired. Please sign in again.');
  }

  // Security: Validate pageSize to prevent abuse
  const safePageSize = Math.min(Math.max(1, parseInt(pageSize, 10) || 100), 100);

  // Build the query: xlsx files in the shared folder, not trashed
  let q = `'${SHARED_FOLDER_ID}' in parents and mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and trashed=false`;
  if (searchQuery && searchQuery.trim()) {
    // Security: Sanitize search query
    const sanitized = sanitizeSearchQuery(searchQuery);
    if (sanitized) {
      q += ` and name contains '${sanitized}'`;
    }
  }

  const params = new URLSearchParams({
    q,
    pageSize: String(safePageSize),
    fields: 'nextPageToken,files(id,name,modifiedTime,size,mimeType,owners,iconLink,webViewLink)',
    orderBy: 'modifiedTime desc',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  if (pageToken) {
    params.set('pageToken', pageToken);
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (response.status === 401) {
    accessToken = null;
    tokenExpiresAt = null;
    throw new Error('Session expired. Please sign in again.');
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Google Drive API error (${response.status})`);
  }

  const data = await response.json();
  
  // Security: Filter out any files that don't match allowed MIME types
  const safeFiles = (data.files || []).filter(file => 
    ALLOWED_MIME_TYPES.includes(file.mimeType)
  );
  
  return {
    files: safeFiles,
    nextPageToken: data.nextPageToken || null,
  };
}

/**
 * Download an xlsx file from Google Drive as an ArrayBuffer.
 *
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<ArrayBuffer>}
 */
export async function downloadFile(fileId) {
  // Security: Validate file ID format
  if (!isValidFileId(fileId)) {
    throw new Error('Invalid file ID format.');
  }
  
  if (!accessToken) {
    throw new Error('Not signed in. Please sign in with Google first.');
  }
  
  if (isTokenExpired()) {
    accessToken = null;
    tokenExpiresAt = null;
    throw new Error('Session expired. Please sign in again.');
  }

  // Security: First fetch file metadata to validate size and type
  const metaResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,size,mimeType&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  
  if (metaResponse.status === 401) {
    accessToken = null;
    tokenExpiresAt = null;
    throw new Error('Session expired. Please sign in again.');
  }
  
  if (!metaResponse.ok) {
    const err = await metaResponse.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to get file info (${metaResponse.status})`);
  }
  
  const fileMeta = await metaResponse.json();
  
  // Security: Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(fileMeta.mimeType)) {
    throw new Error('File type not allowed. Only Excel files (.xlsx, .xls) are supported.');
  }
  
  // Security: Validate file size
  const fileSize = parseInt(fileMeta.size, 10);
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`);
  }

  // Now download the actual file content
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (response.status === 401) {
    accessToken = null;
    tokenExpiresAt = null;
    throw new Error('Session expired. Please sign in again.');
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to download file (${response.status})`);
  }

  return response.arrayBuffer();
}
