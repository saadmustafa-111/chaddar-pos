'use client';

import { useEffect, useState, useRef } from 'react';
import {
  businessProfileApi,
  BusinessProfile,
} from '../../../../features/settings/api/business-profile';

function CoilIconSmall({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3c0 4-2 6-2 9s2 5 2 9" />
      <path d="M12 3c0 4 2 6 2 9s-2 5-2 9" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

import {
  ErrorBanner,
  FormField,
  LoadingState,
  PrimaryButton,
  SectionCard,
  TextInput,
  InlineError,
} from '../../../../features/ui';

function defaultProfile(): BusinessProfile {
  return {
    id: 0,
    shopName: 'SteelCoil POS',
    address: '',
    phone: '',
    taxNumber: '',
    footerMessage: 'Thank you for your business.',
    logoUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default function BusinessSettingsPage() {
  const [profile, setProfile] = useState<BusinessProfile>(defaultProfile());
  const [form, setForm] = useState<BusinessProfile>(defaultProfile());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await businessProfileApi.get();
        if (cancelled) return;
        setProfile(data);
        setForm(data);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load business profile',
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoError('');
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setLogoError('Only JPG, PNG, and WebP images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('File size must be under 5 MB.');
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleRemoveLogo = () => {
    setForm((f) => ({ ...f, logoUrl: null }));
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLogoUpload = async () => {
    if (!logoFile) return;
    setIsUploadingLogo(true);
    setLogoError('');
    try {
      const res = await businessProfileApi.uploadLogo(logoFile);
      setForm((f) => ({ ...f, logoUrl: res.logoUrl }));
      setLogoFile(null);
      setLogoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    if (!form.shopName.trim()) {
      setSaveError('Shop name is required');
      return;
    }
    setIsSaving(true);
    try {
      const updated = await businessProfileApi.update({
        shopName: form.shopName.trim(),
        address: form.address?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        taxNumber: form.taxNumber?.trim() || undefined,
        footerMessage: form.footerMessage?.trim() || undefined,
        logoUrl: form.logoUrl ?? undefined,
      });
      setProfile(updated);
      setForm(updated);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Failed to save business profile',
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading business profile..." />;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">
          Business Profile
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Shown on every printed invoice and receipt.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      <SectionCard
        title="Invoice Header"
        description="Used on every printed sale receipt and invoice."
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <FormField label="Shop Name" required>
            <TextInput
              value={form.shopName}
              onChange={(e) =>
                setForm({ ...form, shopName: e.target.value })
              }
              maxLength={100}
              required
            />
          </FormField>

          <FormField label="Logo">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-[#1C232C] border border-[#252C35] flex items-center justify-center overflow-hidden shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
                ) : form.logoUrl ? (
                  <img src={form.logoUrl} alt="Logo" className="w-full h-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <CoilIconSmall className="w-7 h-7 text-zinc-600" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleLogoChange}
                  className="hidden"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#1C232C] border border-[#252C35] text-zinc-300 hover:bg-[#252C35] transition-colors"
                  >
                    {logoFile ? 'Change' : 'Upload'} Logo
                  </button>
                  {(form.logoUrl || logoFile) && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="text-xs px-3 py-1.5 rounded-lg bg-transparent border border-[#252C35] text-zinc-500 hover:text-zinc-300 hover:border-[#3d4a5c] transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {logoFile && (
                  <button
                    type="button"
                    onClick={handleLogoUpload}
                    disabled={isUploadingLogo}
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#1a2332] hover:bg-[#243044] disabled:opacity-50 text-zinc-200 transition-colors w-fit"
                  >
                    {isUploadingLogo ? 'Uploading...' : 'Confirm & Upload'}
                  </button>
                )}
                {logoError && <p className="text-xs text-red-400">{logoError}</p>}
                <p className="text-[11px] text-zinc-600">JPG, PNG, WebP · max 5 MB</p>
              </div>
            </div>
          </FormField>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Phone">
              <TextInput
                value={form.phone ?? ''}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
                maxLength={30}
                placeholder="Optional"
              />
            </FormField>
            <FormField label="Tax / GST Number">
              <TextInput
                value={form.taxNumber ?? ''}
                onChange={(e) =>
                  setForm({ ...form, taxNumber: e.target.value })
                }
                maxLength={50}
                placeholder="Optional"
              />
            </FormField>
          </div>
          <FormField label="Address">
            <TextInput
              value={form.address ?? ''}
              onChange={(e) =>
                setForm({ ...form, address: e.target.value })
              }
              maxLength={255}
              placeholder="Optional"
            />
          </FormField>
          <FormField label="Footer Message">
            <TextInput
              value={form.footerMessage ?? ''}
              onChange={(e) =>
                setForm({ ...form, footerMessage: e.target.value })
              }
              maxLength={255}
              placeholder="Optional"
            />
          </FormField>
          {saveError && <InlineError message={saveError} />}
          <div className="flex justify-end pt-2">
            <PrimaryButton
              type="submit"
              isLoading={isSaving}
              loadingLabel="Saving..."
            >
              Save Profile
            </PrimaryButton>
          </div>
        </form>
      </SectionCard>

      {profile.updatedAt && (
        <p className="text-xs text-zinc-500 text-right">
          Last updated {new Date(profile.updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}