'use client';

import { ReactNode, SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

const baseInputClass =
  'w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 placeholder:text-zinc-600 disabled:opacity-60';

const errorInputClass = 'border-red-500/50 focus:ring-red-500/40';

interface FieldProps {
  label?: string;
  required?: boolean;
  hint?: string | null;
  error?: string | null;
  className?: string;
  children: ReactNode;
}

export function FormField({
  label,
  required,
  hint,
  error,
  className,
  children,
}: FieldProps) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-zinc-500 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-400 mt-1.5">{error}</p>
      ) : hint ? (
        <p className="text-xs text-zinc-600 mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function TextInput({ invalid, className, ...rest }: TextInputProps) {
  return (
    <input
      {...rest}
      className={`${baseInputClass} ${
        invalid ? errorInputClass : ''
      } ${className ?? ''}`}
    />
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export function SelectInput({ invalid, className, children, ...rest }: SelectProps) {
  return (
    <select
      {...rest}
      className={`${baseInputClass} ${
        invalid ? errorInputClass : ''
      } ${className ?? ''}`}
    >
      {children}
    </select>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function TextareaInput({ invalid, className, ...rest }: TextareaProps) {
  return (
    <textarea
      {...rest}
      className={`${baseInputClass} resize-y min-h-[80px] ${
        invalid ? errorInputClass : ''
      } ${className ?? ''}`}
    />
  );
}

export function PrimaryButton({
  isLoading,
  loadingLabel,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || isLoading}
      className={`bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-900 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 ${
        rest.className ?? ''
      }`}
    >
      {isLoading ? (
        <>
          <Spinner />
          {loadingLabel ?? 'Saving...'}
        </>
      ) : (
        children
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}