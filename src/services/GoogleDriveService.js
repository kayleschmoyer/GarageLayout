/**
 * GoogleDriveService - Handles Google OAuth 2.0 and Google Drive file operations
 *
 * Uses Google Identity Services (GIS) for OAuth token-based auth.
 * The user must provide their own Google Cloud Client ID via the UI.
 *
 * Scopes:
 *   - https://www.googleapis.com/auth/drive.readonly (read-only access to Drive files)
 */

const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

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
 * @param {string} clientId - Google Cloud OAuth 2.0 Client ID
 * @returns {Promise<string>} access token
 */
export async function signInWithGoogle(clientId) {
  await loadGisScript();

  return new Promise((resolve, reject) => {
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
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
 * List xlsx files from the user's Google Drive.
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

  // Build the query: xlsx files only, not trashed
  let q = "mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and trashed=false";
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
