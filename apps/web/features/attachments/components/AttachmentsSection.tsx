'use client';

import { useCallback, useState, useRef, DragEvent, ChangeEvent } from 'react';
import {
  attachmentsApi,
  Attachment,
  AttachmentEntityType,
  DocumentType,
  documentTypeLabels,
} from '../api/attachments';
import { ConfirmDialog, SectionCard } from '../../ui';
import { formatDate } from '../../shared/utils/format';

interface AttachmentsSectionProps {
  entityType: AttachmentEntityType;
  entityId: number;
  title?: string;
  description?: string;
  allowUpload?: boolean;
  allowDelete?: boolean;
  allowedDocumentTypes?: DocumentType[];
  onAttachmentsChanged?: () => void;
}

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export function AttachmentsSection({
  entityType,
  entityId,
  title = 'Documents',
  description = 'Upload and manage supporting documents.',
  allowUpload = true,
  allowDelete = true,
  allowedDocumentTypes,
  onAttachmentsChanged,
}: AttachmentsSectionProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('OTHER');
  const [uploadNote, setUploadNote] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAttachments = useCallback(async () => {
    try {
      const data = await attachmentsApi.findByEntity(entityType, entityId);
      setAttachments(data);
    } catch (err) {
      setUploadState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load attachments',
      }));
    } finally {
      setIsLoading(false);
    }
  }, [entityType, entityId]);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadState((prev) => ({
        ...prev,
        error: 'Invalid file type. Allowed: JPG, PNG, WebP, PDF',
      }));
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setUploadState((prev) => ({
        ...prev,
        error: 'File size exceeds 10MB limit',
      }));
      return;
    }
    setSelectedFile(file);
    setUploadState((prev) => ({ ...prev, error: null }));
    setShowUploadForm(true);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploadState((prev) => ({ ...prev, isUploading: true, progress: 0, error: null }));
    try {
      await attachmentsApi.upload(selectedFile, {
        entityType,
        entityId,
        documentType: selectedDocType,
        note: uploadNote || undefined,
      });
      setSelectedFile(null);
      setUploadNote('');
      setSelectedDocType('OTHER');
      setShowUploadForm(false);
      await loadAttachments();
      onAttachmentsChanged?.();
    } catch (err) {
      setUploadState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Upload failed',
      }));
    } finally {
      setUploadState((prev) => ({ ...prev, isUploading: false }));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await attachmentsApi.delete(deleteTarget.id, entityType, entityId);
      setDeleteTarget(null);
      await loadAttachments();
      onAttachmentsChanged?.();
    } catch {
      // Error is handled silently as delete confirmation is already shown
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = (attachment: Attachment) => {
    window.open(attachmentsApi.getDownloadUrl(attachment.id), '_blank');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImage = (mimeType: string): boolean => mimeType.startsWith('image/');
  const isPdf = (mimeType: string): boolean => mimeType === 'application/pdf';

  const documentTypesToShow = allowedDocumentTypes || [
    'RECEIPT',
    'INVOICE',
    'PAYMENT_PROOF',
    'DELIVERY_CHALLAN',
    'PURCHASE_DOCUMENT',
    'CNIC',
    'OTHER',
  ];

  return (
    <>
      <SectionCard
        title={title}
        description={description}
        actions={
          allowUpload ? (
            <button
              type="button"
              onClick={() => {
                setShowUploadForm(true);
                setSelectedFile(null);
                setUploadNote('');
                setSelectedDocType('OTHER');
                setUploadState({ isUploading: false, progress: 0, error: null });
              }}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload
            </button>
          ) : undefined
        }
      >
        {isLoading ? (
          <div className="p-4 text-center text-sm text-zinc-500">Loading documents...</div>
        ) : attachments.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">
            {allowUpload ? (
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border-2 border-dashed border-zinc-700 rounded-lg p-6 hover:border-zinc-600 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="w-8 h-8 mx-auto mb-2 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-zinc-400">Drop files here or click to upload</p>
                <p className="text-zinc-600 text-xs mt-1">JPG, PNG, WebP, PDF up to 10MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_TYPES.join(',')}
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </div>
            ) : (
              <p>No documents attached.</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="p-3 flex items-center gap-3 hover:bg-zinc-900/50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
                  {isImage(attachment.mimeType) ? (
                    <img
                      src={attachmentsApi.getPreviewUrl(attachment.id)}
                      alt={attachment.originalFilename}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : isPdf(attachment.mimeType) ? (
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => setPreviewAttachment(attachment)}
                    className="text-sm text-zinc-200 hover:text-white font-medium truncate block text-left w-full"
                  >
                    {attachment.originalFilename}
                  </button>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-zinc-500">
                      {documentTypeLabels[attachment.documentType]}
                    </span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-xs text-zinc-500">
                      {formatFileSize(attachment.sizeBytes)}
                    </span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-xs text-zinc-500">
                      {formatDate(attachment.uploadedAt)}
                    </span>
                    {attachment.uploadedBy && (
                      <>
                        <span className="text-zinc-700">·</span>
                        <span className="text-xs text-zinc-500">by {attachment.uploadedBy}</span>
                      </>
                    )}
                  </div>
                  {attachment.note && (
                    <p className="text-xs text-zinc-400 mt-1 truncate">{attachment.note}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewAttachment(attachment)}
                    className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded transition-colors"
                    title="View"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(attachment)}
                    className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded transition-colors"
                    title="Download"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  {allowDelete && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(attachment)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 rounded transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
            {allowUpload && (
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="p-3 border-t border-zinc-800 cursor-pointer hover:bg-zinc-900/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add more documents</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_TYPES.join(',')}
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {showUploadForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-[#141A22] border border-zinc-800 rounded-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-base font-semibold text-zinc-100 mb-4">Upload Document</h3>
              {selectedFile && (
                <div className="mb-4 p-3 bg-zinc-900 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center">
                      {isImage(selectedFile.type) ? (
                        <img
                          src={URL.createObjectURL(selectedFile)}
                          alt="Preview"
                          className="w-full h-full object-cover rounded"
                        />
                      ) : isPdf(selectedFile.type) ? (
                        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate">{selectedFile.name}</p>
                      <p className="text-xs text-zinc-500">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setShowUploadForm(false);
                      }}
                      className="p-1 text-zinc-500 hover:text-zinc-300"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Document Type</label>
                  <select
                    value={selectedDocType}
                    onChange={(e) => setSelectedDocType(e.target.value as DocumentType)}
                    className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                  >
                    {documentTypesToShow.map((type) => (
                      <option key={type} value={type}>
                        {documentTypeLabels[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Note (optional)</label>
                  <textarea
                    value={uploadNote}
                    onChange={(e) => setUploadNote(e.target.value)}
                    placeholder="Add a note..."
                    className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 resize-y min-h-[60px]"
                  />
                </div>
                {uploadState.error && (
                  <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded">{uploadState.error}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setShowUploadForm(false);
                }}
                disabled={uploadState.isUploading}
                className="text-zinc-400 hover:text-zinc-200 text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!selectedFile || uploadState.isUploading}
                className="bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-900 text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {uploadState.isUploading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Uploading...
                  </>
                ) : (
                  'Upload'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewAttachment && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4" onClick={() => setPreviewAttachment(null)}>
          <div className="bg-[#141A22] border border-zinc-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-zinc-200">{previewAttachment.originalFilename}</h3>
                <p className="text-xs text-zinc-500">
                  {documentTypeLabels[previewAttachment.documentType]} · {formatFileSize(previewAttachment.sizeBytes)} · {formatDate(previewAttachment.uploadedAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownload(previewAttachment)}
                  className="p-2 text-zinc-500 hover:text-zinc-300 rounded transition-colors"
                  title="Download"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="p-2 text-zinc-500 hover:text-zinc-300 rounded transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4">
              {isImage(previewAttachment.mimeType) ? (
                <img
                  src={attachmentsApi.getPreviewUrl(previewAttachment.id)}
                  alt={previewAttachment.originalFilename}
                  className="max-w-full h-auto rounded-lg"
                />
              ) : isPdf(previewAttachment.mimeType) ? (
                <iframe
                  src={attachmentsApi.getPreviewUrl(previewAttachment.id)}
                  className="w-full h-[60vh] rounded-lg"
                  title={previewAttachment.originalFilename}
                />
              ) : (
                <div className="text-center py-8 text-zinc-500">
                  <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>Preview not available</p>
                  <button
                    type="button"
                    onClick={() => handleDownload(previewAttachment)}
                    className="mt-2 text-sm text-zinc-400 hover:text-zinc-300"
                  >
                    Download to view
                  </button>
                </div>
              )}
              {previewAttachment.note && (
                <div className="mt-4 p-3 bg-zinc-900 rounded-lg">
                  <p className="text-xs text-zinc-500 mb-1">Note</p>
                  <p className="text-sm text-zinc-300">{previewAttachment.note}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Document"
        description={`Are you sure you want to delete "${deleteTarget?.originalFilename}"? This action cannot be undone.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

export { AttachmentsSection as default };
