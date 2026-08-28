'use client';

import { useEffect, useState } from 'react';
import {
  Customer,
  CreateCustomerRequest,
  customersApi,
} from '../api/customers';
import {
  FormField,
  TextInput,
  TextareaInput,
  PrimaryButton,
  InlineError,
} from '../../ui';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (customer: Customer) => void;
}

export function NewCustomerModal({ open, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setName('');
      setPhone('');
      setAddress('');
      setNote('');
      setError('');
    });
  }, [open]);

  if (!open) return null;

  const nameInvalid = name.trim().length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (nameInvalid) {
      setError('Name is required.');
      return;
    }

    const payload: CreateCustomerRequest = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      note: note.trim() || undefined,
    };

    setIsSaving(true);
    try {
      const created = await customersApi.create(payload);
      onSaved(created);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create customer',
      );
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-[#141A22] border border-zinc-800 rounded-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-100">
            New Customer
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            Saved directly from the sale screen. This card is auto-selected
            for the current sale.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <FormField label="Name" required error={nameInvalid ? 'Required' : null}>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              maxLength={100}
              invalid={nameInvalid}
              placeholder="e.g. Khan Traders"
            />
          </FormField>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Phone">
              <TextInput
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={30}
                placeholder="Optional"
              />
            </FormField>
            <FormField label="Address">
              <TextInput
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                maxLength={255}
                placeholder="Optional"
              />
            </FormField>
          </div>
          <FormField label="Note">
            <TextareaInput
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="Optional"
            />
          </FormField>
          {error && <InlineError message={error} />}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="text-sm text-zinc-400 hover:text-zinc-200 font-medium px-4 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <PrimaryButton
              type="submit"
              isLoading={isSaving}
              loadingLabel="Saving..."
              disabled={nameInvalid}
            >
              Create &amp; Select
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}