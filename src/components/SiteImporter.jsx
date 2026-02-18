import React, { useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Button, Modal, ModalDialog } from '@mui/joy';
import { AppContext } from '../App';
import {
  signInWithGoogle,
  signOut,
  listXlsxFiles,
  downloadFile,
  CLIENT_ID,
} from '../services/GoogleDriveService';
import { parseExcelFile, getImportSummary } from '../services/ExcelParserService';

// ========================= CONSTANTS =========================

const MODAL_SX = Object.freeze({
  borderRadius: '12px',
  p: 0,
  width: '100%',
  maxWidth: 560,
  bgcolor: '#18181b',
  border: '1px solid #3f3f46',
  overflow: 'hidden',
});

// ========================= HELPERS =========================

function formatFileSize(bytes) {
  if (!bytes) return '--';
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(isoString) {
  if (!isoString) return '--';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ========================= COMPONENT =========================

export default function SiteImporter() {
  const { setGarages, setCurrentView } = useContext(AppContext);

  // Auth state
  const [authenticated, setAuthenticated] = useState(false);

  // File browser state
  const [files, setFiles] = useState([]);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const searchDebounceRef = useRef(null);

  // Import state
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // ---- Auth handlers ----

  const handleSignIn = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      setAuthenticated(true);
      // Auto-load files after sign in
      const result = await listXlsxFiles();
      setFiles(result.files);
      setNextPageToken(result.nextPageToken);
    } catch (err) {
      setError(err.message || 'Sign-in failed');
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(() => {
    signOut();
    setAuthenticated(false);
    setFiles([]);
    setNextPageToken(null);
    setSelectedFile(null);
    setSearchQuery('');
    setImportResult(null);
    setError('');
  }, []);

  // ---- File search ----

  const performSearch = useCallback(async (query) => {
    if (!authenticated) return;
    setLoading(true);
    setError('');
    try {
      const result = await listXlsxFiles({ searchQuery: query });
      setFiles(result.files);
      setNextPageToken(result.nextPageToken);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  const handleSearchChange = useCallback((e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      performSearch(val);
    }, 400);
  }, [performSearch]);

  const handleLoadMore = useCallback(async () => {
    if (!nextPageToken || loading) return;
    setLoading(true);
    try {
      const result = await listXlsxFiles({ pageToken: nextPageToken, searchQuery });
      setFiles((prev) => [...prev, ...result.files]);
      setNextPageToken(result.nextPageToken);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [nextPageToken, loading, searchQuery]);

  // ---- Import handler ----

  const handleSelectFile = useCallback((file) => {
    setSelectedFile(file);
    setImportResult(null);
  }, []);

  const handleImport = useCallback(async () => {
    if (!selectedFile) return;
    setImporting(true);
    setError('');
    try {
      const buffer = await downloadFile(selectedFile.id);
      const parsed = parseExcelFile(buffer);
      const summary = getImportSummary(parsed);
      setImportResult({ parsed, summary, fileName: selectedFile.name });
      setShowConfirmModal(true);
    } catch (err) {
      setError(err.message || 'Failed to import file');
    } finally {
      setImporting(false);
    }
  }, [selectedFile]);

  const handleConfirmImport = useCallback(() => {
    if (!importResult) return;
    
    // Add the Google Sheet as a quick link to the first garage
    const garagesWithLink = importResult.parsed.garages.map((garage, index) => {
      if (index === 0 && selectedFile) {
        // Create Google Drive link for the imported file
        const driveLink = selectedFile.webViewLink || 
          `https://drive.google.com/file/d/${selectedFile.id}/view`;
        
        const newQuickLink = {
          id: 1,
          name: selectedFile.name.replace(/\.xlsx?$/i, '') || 'Configuration Sheet',
          url: driveLink,
          icon: 'sheets'
        };
        
        return {
          ...garage,
          quickLinks: [newQuickLink, ...garage.quickLinks]
        };
      }
      return garage;
    });
    
    setGarages(garagesWithLink);
    setShowConfirmModal(false);
    setCurrentView('garages');
  }, [importResult, selectedFile, setGarages, setCurrentView]);

  // ---- Skip / manual mode ----
  const handleSkip = useCallback(() => {
    setCurrentView('garages');
  }, [setCurrentView]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  // ========================= RENDER =========================

  return (
    <div className="selector-view site-importer-fullpage">
      {/* Main Content */}
      <div className="site-importer-content">
        {!authenticated ? (
          /* ---- Landing / Sign-In View ---- */
          <div className="site-importer-landing">
            <div className="site-importer-card">
              {/* Logo Section */}
              <div className="site-importer-logo-section">
                <img 
                  src="https://www.ensight-technologies.com/wp-content/uploads/2023/08/Layer_1-8.png" 
                  alt="Ensight Technologies" 
                  className="site-importer-company-logo"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
              
              {/* Welcome Content */}
              <div className="site-importer-hero">
                <h1 className="site-importer-title">Site Editor</h1>
                <p className="site-importer-subtitle">
                  Sign in to manage your parking infrastructure. Import configurations or start fresh.
                </p>

                {/* Sign In Button */}
                <button
                  className="site-importer-google-btn"
                  onClick={handleSignIn}
                  disabled={loading}
                >
                  <div className="google-btn-icon">
                    <svg width="16" height="16" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                  </div>
                  <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
                  <svg className="google-btn-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              
              {/* Features Section */}
              <div className="site-importer-features">
                <div className="site-importer-feature">
                  <div className="feature-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                      <line x1="12" y1="22.08" x2="12" y2="12" />
                    </svg>
                  </div>
                  <div className="feature-text">
                    <strong>Import Config</strong>
                    <span>From Google Drive</span>
                  </div>
                </div>
                <div className="site-importer-feature">
                  <div className="feature-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="3" y1="9" x2="21" y2="9" />
                      <line x1="9" y1="21" x2="9" y2="9" />
                    </svg>
                  </div>
                  <div className="feature-text">
                    <strong>Visual Editor</strong>
                    <span>Drag & drop</span>
                  </div>
                </div>
                <div className="site-importer-feature">
                  <div className="feature-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </div>
                  <div className="feature-text">
                    <strong>Export Data</strong>
                    <span>Multiple formats</span>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="site-importer-error-card">
                <div className="error-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="error-content">
                  {error.includes('redirect_uri_mismatch') ? (
                    <>
                      <strong>OAuth origin not registered</strong>
                      <div style={{ marginTop: 6, fontSize: 11, color: '#fbbf24', lineHeight: 1.5 }}>
                        <p style={{ margin: '0 0 6px' }}>
                          The origin <code style={{ background: '#27272a', padding: '2px 4px', borderRadius: 3, color: '#f0f0f0', fontSize: 10 }}>{window.location.origin}</code> is
                          not authorized for this OAuth client.
                        </p>
                        <p style={{ margin: '0 0 4px' }}><strong>To fix this:</strong></p>
                        <ol style={{ margin: '0', paddingLeft: 16, fontSize: 10 }}>
                          <li>
                            Open the{' '}
                            <a href={`https://console.cloud.google.com/apis/credentials/oauthclient/${CLIENT_ID}`} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>
                              Google Cloud Console
                            </a>
                          </li>
                          <li>
                            Add origin: <code style={{ background: '#27272a', padding: '1px 4px', borderRadius: 2, color: '#f0f0f0', fontSize: 9 }}>{window.location.origin}</code>
                          </li>
                          <li>Save and wait for propagation</li>
                        </ol>
                      </div>
                    </>
                  ) : (
                    <>
                      {error}
                      {error.includes('invalid_request') && (
                        <div style={{ marginTop: 6, fontSize: 10, color: '#fbbf24', lineHeight: 1.4 }}>
                          <strong>Hint:</strong> Verify OAuth Client ID in the{' '}
                          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>
                            Cloud Console
                          </a>.
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ---- File Browser View ---- */
          <div className="site-importer-browser">
            <div className="site-importer-browser-header">
              <h2 className="site-importer-browser-title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                Select Configuration File
              </h2>
              <button className="site-importer-skip-btn-small" onClick={handleSkip}>
                Skip &rarr;
              </button>
            </div>

            {/* Search Bar */}
            <div className="site-importer-search-bar">
              <div className="site-importer-search-input-wrap">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="site-importer-search-icon">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="site-importer-search"
                  placeholder="Search files by name..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
                {searchQuery && (
                  <button
                    className="site-importer-search-clear"
                    onClick={() => { setSearchQuery(''); performSearch(''); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="site-importer-file-count">
                {files.length} file{files.length !== 1 ? 's' : ''} found
              </div>
            </div>

            {error && (
              <div className="site-importer-error">{error}</div>
            )}

            {/* File List */}
            <div className="site-importer-file-list">
              {files.length === 0 && !loading && (
                <div className="site-importer-empty">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <p>No .xlsx files found{searchQuery ? ` matching "${searchQuery}"` : ''}.</p>
                </div>
              )}

              {files.map((file) => (
                <div
                  key={file.id}
                  className={`site-importer-file-row ${selectedFile?.id === file.id ? 'selected' : ''}`}
                  onClick={() => handleSelectFile(file)}
                >
                  <div className="site-importer-file-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#22c55e" />
                      <polyline points="14 2 14 8 20 8" stroke="#22c55e" />
                      <line x1="16" y1="13" x2="8" y2="13" stroke="#22c55e" />
                      <line x1="16" y1="17" x2="8" y2="17" stroke="#22c55e" />
                    </svg>
                  </div>
                  <div className="site-importer-file-info">
                    <div className="site-importer-file-name">{file.name}</div>
                    <div className="site-importer-file-meta">
                      {formatDate(file.modifiedTime)}
                      <span className="site-importer-file-meta-sep">&middot;</span>
                      {formatFileSize(file.size)}
                      {file.owners?.[0]?.displayName && (
                        <>
                          <span className="site-importer-file-meta-sep">&middot;</span>
                          {file.owners[0].displayName}
                        </>
                      )}
                    </div>
                  </div>
                  {selectedFile?.id === file.id && (
                    <div className="site-importer-file-check">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="site-importer-loading">
                  <div className="site-importer-spinner" />
                  <span>Loading files...</span>
                </div>
              )}

              {nextPageToken && !loading && (
                <button className="site-importer-load-more" onClick={handleLoadMore}>
                  Load more files
                </button>
              )}
            </div>

            {/* Import Button */}
            {selectedFile && (
              <div className="site-importer-action-bar">
                <div className="site-importer-selected-info">
                  Selected: <strong>{selectedFile.name}</strong>
                </div>
                <button
                  className="site-importer-import-btn"
                  onClick={handleImport}
                  disabled={importing}
                >
                  {importing ? (
                    <>
                      <div className="site-importer-spinner-small" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Import &amp; Build Site
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Import Confirmation Modal */}
      <Modal open={showConfirmModal} onClose={() => setShowConfirmModal(false)}>
        <ModalDialog sx={{ ...MODAL_SX, maxWidth: 680, p: 0 }}>
          {/* Header */}
          <div className="import-modal-header">
            <div className="import-modal-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <div className="import-modal-header-text">
              <h3 className="import-modal-title">Import Summary</h3>
              <p className="import-modal-filename">{importResult?.fileName}</p>
            </div>
          </div>

          {importResult && (
            <div className="import-modal-body">
              {/* Summary stats */}
              <div className="import-modal-stats">
                <div className="import-modal-stat">
                  <div className="import-modal-stat-icon garages">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  </div>
                  <div className="import-modal-stat-info">
                    <div className="import-modal-stat-num">{importResult.summary.totalGarages}</div>
                    <div className="import-modal-stat-label">Garages</div>
                  </div>
                </div>
                <div className="import-modal-stat">
                  <div className="import-modal-stat-icon levels">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="3" y1="9" x2="21" y2="9" />
                      <line x1="3" y1="15" x2="21" y2="15" />
                    </svg>
                  </div>
                  <div className="import-modal-stat-info">
                    <div className="import-modal-stat-num">{importResult.summary.totalLevels}</div>
                    <div className="import-modal-stat-label">Levels</div>
                  </div>
                </div>
                <div className="import-modal-stat">
                  <div className="import-modal-stat-icon devices">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
                      <rect x="9" y="9" width="6" height="6" />
                      <line x1="9" y1="1" x2="9" y2="4" />
                      <line x1="15" y1="1" x2="15" y2="4" />
                      <line x1="9" y1="20" x2="9" y2="23" />
                      <line x1="15" y1="20" x2="15" y2="23" />
                      <line x1="20" y1="9" x2="23" y2="9" />
                      <line x1="20" y1="14" x2="23" y2="14" />
                      <line x1="1" y1="9" x2="4" y2="9" />
                      <line x1="1" y1="14" x2="4" y2="14" />
                    </svg>
                  </div>
                  <div className="import-modal-stat-info">
                    <div className="import-modal-stat-num">{importResult.summary.totalDevices}</div>
                    <div className="import-modal-stat-label">Devices</div>
                  </div>
                </div>
              </div>

              {/* Tab breakdown */}
              <div className="import-modal-sheets">
                <div className="import-modal-sheets-header">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                  </svg>
                  Sheet Data
                </div>
                <div className="import-modal-sheets-list">
                  {Object.entries(importResult.summary.tabCounts).map(([tab, count]) => (
                    <div key={tab} className="import-modal-sheet-row">
                      <span className="import-modal-sheet-name">{tab}</span>
                      <span className="import-modal-sheet-count">{count} rows</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning */}
              <div className="import-modal-warning">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>This will replace all existing garages and levels with the imported data.</span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="import-modal-footer">
            <button 
              className="import-modal-btn cancel"
              onClick={() => setShowConfirmModal(false)}
            >
              Cancel
            </button>
            <button 
              className="import-modal-btn confirm"
              onClick={handleConfirmImport}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Confirm Import
            </button>
          </div>
        </ModalDialog>
      </Modal>
    </div>
  );
}
