'use client';

import { useEffect, useState, useRef, ChangeEvent } from 'react';
import {
  Customer,
  CustomerLedgerEntry,
  customersApi,
  RecordPaymentRequest,
} from '../api/customers';
import {
  FormField,
  TextInput,
  TextareaInput,
  PrimaryButton,
  InlineError,
  InlineInfo,
  SummaryTile,
} from '../../ui';
import { formatPaisa, parseRupeeInput } from '../../shared/utils/format';
import { attachmentsApi } from '../../attachments';

interface Props {
  open: boolean;
  onClose: () => void;
  customer: Customer;
  onSaved: (entry: CustomerLedgerEntry) => void;
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

export function RecordPaymentModal({
  open,
  onClose,
  customer,
  onSaved,
}: Props) {
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setAmount('');
      setPaymentDate(todayIso());
      setNote('');
      setReceiptFile(null);
      setReceiptPreview(null);
      setError('');
    });
  }, [open]);

  const handleReceiptChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('Receipt file must be under 10MB');
      return;
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Allowed: JPG, PNG, WebP, PDF');
      return;
    }
    setReceiptFile(file);
    if (file.type.startsWith('image/')) {
      setReceiptPreview(URL.createObjectURL(file));
    } else {
      setReceiptPreview(null);
    }
  };

  const clearReceipt = () => {
    setReceiptFile(null);
    if (receiptPreview) {
      URL.revokeObjectURL(receiptPreview);
    }
    setReceiptPreview(null);
    if (receiptInputRef.current) {
      receiptInputRef.current.value = '';
    }
  };

  if (!open) return null;

  const outstanding = Number(customer.currentBalancePaisa);
  const amountPaisa = amount ? parseRupeeInput(amount) : 0;
  const overpayment = amountPaisa > outstanding && outstanding > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (amountPaisa <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    if (overpayment) {
      setError(
        `Amount (${formatPaisa(amountPaisa)}) exceeds outstanding balance (${formatPaisa(outstanding)})`,
      );
      return;
    }

    const payload: RecordPaymentRequest = {
      amountPaisa,
      paymentDate,
      note: note.trim() || undefined,
    };
    setIsSaving(true);
    try {
      const entry = await customersApi.recordPayment(customer.id, payload);

      if (receiptFile) {
        try {
          await attachmentsApi.upload(receiptFile, {
            entityType: 'CUSTOMER_PAYMENT',
            entityId: entry.id,
            documentType: 'PAYMENT_PROOF',
            note: `Receipt for payment on ${paymentDate}`,
          });
        } catch (uploadErr) {
          console.error('Failed to upload receipt:', uploadErr);
        }
      }

      onSaved(entry);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
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
            Record Payment
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            Record a payment received from {customer.name}.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <SummaryTile
            label="Outstanding Balance"
            value={formatPaisa(outstanding)}
            variant={outstanding > 0 ? 'highlight' : 'default'}
            helper={
              outstanding > 0
                ? 'Maximum payment: ' + formatPaisa(outstanding)
                : 'No outstanding balance'
            }
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField
              label="Amount (Rs)"
              required
              error={overpayment ? 'Exceeds outstanding' : null}
            >
              <TextInput
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                autoFocus
                disabled={outstanding <= 0}
                invalid={overpayment}
                placeholder="0.00"
              />
            </FormField>
            <FormField label="Date" required>
              <TextInput
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                disabled={outstanding <= 0}
              />
            </FormField>
          </div>
          <FormField label="Note">
            <TextareaInput
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              disabled={outstanding <= 0}
              placeholder="Optional"
            />
          </FormField>
          <FormField label="Upload Receipt (optional)">
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleReceiptChange}
              className="hidden"
            />
            {receiptFile ? (
              <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg">
                {receiptPreview ? (
                  <img
                    src={receiptPreview}
                    alt="Receipt preview"
                    className="w-12 h-12 object-cover rounded"
                  />
                ) : (
                  <div className="w-12 h-12 bg-zinc-800 rounded flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 truncate">{receiptFile.name}</p>
                  <p className="text-xs text-zinc-500">
                    {(receiptFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearReceipt}
                  className="p-1.5 text-zinc-500 hover:text-red-400 rounded transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => receiptInputRef.current?.click()}
                disabled={outstanding <= 0}
                className="w-full border-2 border-dashed border-zinc-700 hover:border-zinc-600 rounded-lg p-4 text-sm text-zinc-500 hover:text-zinc-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload receipt or payment proof
              </button>
            )}
          </FormField>
          {outstanding <= 0 && (
            <InlineInfo>
              This customer has no outstanding balance. Nothing to record.
            </InlineInfo>
          )}
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
              loadingLabel="Recording..."
              disabled={outstanding <= 0}
            >
              Record Payment
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}