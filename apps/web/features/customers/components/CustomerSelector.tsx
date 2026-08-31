'use client';

import { useEffect, useState } from 'react';
import { Customer, customersApi } from '../api/customers';
import { FormField, SelectInput } from '../../ui';

interface Props {
  value: number | null;
  onChange: (id: number | null) => void;
  onCreateNew?: () => void;
  disabled?: boolean;
}

export function CustomerSelector({
  value,
  onChange,
  onCreateNew,
  disabled,
}: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsLoading(true);
    });
    (async () => {
      try {
        const data = await customersApi.findAllActive();
        if (cancelled) return;
        setCustomers(data);
      } catch {
        if (!cancelled) return;
        setCustomers([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = value
    ? customers.find((c) => c.id === value) ?? null
    : null;

  return (
    <FormField label="Customer">
      <div className="flex items-stretch gap-2">
        <SelectInput
          className="flex-1"
          value={value === null ? '' : String(value)}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? null : parseInt(v, 10));
          }}
          disabled={disabled || isLoading}
        >
          <option value="">
            {isLoading ? 'Loading customers...' : 'Cash sale (no customer)'}
          </option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.name}
              {c.phone ? ` · ${c.phone}` : ''}
              {Number(c.currentBalancePaisa) > 0
                ? ` · Due Rs ${(Number(c.currentBalancePaisa) / 100).toFixed(2)}`
                : ''}
            </option>
          ))}
        </SelectInput>
        {onCreateNew && (
          <button
            type="button"
            onClick={onCreateNew}
            disabled={disabled}
            className="text-xs font-medium bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-900 px-3 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New
          </button>
        )}
      </div>
      {selected && (
        <p className="text-xs text-zinc-600 mt-1.5">
          Outstanding: Rs{' '}
          <span
            className={
              Number(selected.currentBalancePaisa) > 0
                ? 'text-red-400 font-medium'
                : 'text-green-400 font-medium'
            }
          >
            {(Number(selected.currentBalancePaisa) / 100).toFixed(2)}
          </span>
        </p>
      )}
    </FormField>
  );
}