/**
 * GoogleDriveService - Handles Google OAuth 2.0 and Google Drive file operations
 *
 * Uses Google Identity Services (GIS) for OAuth token-based auth.
 *
 * Scopes:
 *   - https://www.googleapis.com/auth/drive.readonly (read-only access to Drive files)
 */

const CLIENT_ID = '803815610394-q9jiico10t5obbv9tdib05akm0f8vemr.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';
const SHARED_FOLDER_ID = '1OZXQcKjsZY59gnPFDThSZehJzxsvtjPU';

let tokenClient = null;
let accessToken = null;

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
export async function signInWithGoogle() {
  await loadGisScript();

  return new Promise((resolve, reject) => {
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          accessToken = response.access_token;
          resolve(accessToken);
        },
        error_callback: (err) => {
          reject(new Error(err.message || 'OAuth error'));
        },
      });
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Check if we currently have a valid access token
 */
export function isSignedIn() {
  return !!accessToken;
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
  if (!accessToken) {
    throw new Error('Not signed in. Please sign in with Google first.');
  }

  // Build the query: xlsx files in the shared folder, not trashed
  let q = `'${SHARED_FOLDER_ID}' in parents and mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and trashed=false`;
  if (searchQuery && searchQuery.trim()) {
    // Escape single quotes in search
    const escaped = searchQuery.trim().replace(/'/g, "\\'");
    q += ` and name contains '${escaped}'`;
  }

  const params = new URLSearchParams({
    q,
    pageSize: String(pageSize),
    fields: 'nextPageToken,files(id,name,modifiedTime,size,owners,iconLink,webViewLink)',
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
    throw new Error('Session expired. Please sign in again.');
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Google Drive API error (${response.status})`);
  }

  const data = await response.json();
  return {
    files: data.files || [],
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
  if (!accessToken) {
    throw new Error('Not signed in. Please sign in with Google first.');
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (response.status === 401) {
    accessToken = null;
    throw new Error('Session expired. Please sign in again.');
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to download file (${response.status})`);
  }

  return response.arrayBuffer();
}
