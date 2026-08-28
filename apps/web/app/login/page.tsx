'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '../../features/auth/api/auth';
import { useBranding } from '../../features/settings/hooks/use-branding';

function CoilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3c0 4-2 6-2 9s2 5 2 9" />
      <path d="M12 3c0 4 2 6 2 9s-2 5-2 9" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { branding } = useBranding();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await authApi.login(password);
      router.push('/dashboard');
    } catch {
      setError('Incorrect password. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07090D] relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, rgba(30, 40, 50, 0.4) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 w-full max-w-[400px] px-6">
        <div className="flex justify-center mb-8 -mt-12">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt="Logo"
              className="w-16 h-16 rounded-2xl object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-[#11161D] border border-[#252C35] flex items-center justify-center -mt-2">
              <CoilIcon className="w-8 h-8 text-zinc-400" />
            </div>
          )}
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-wide">
            {branding.shopName}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Inventory POS</p>
        </div>

        <div className="bg-[#11161D] border border-[#252C35] rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2"
              >
                Admin Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#090D12] border border-[#252C35] rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#3d4a5c] transition-colors pr-12"
                  placeholder="Enter password"
                  autoFocus
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOffIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>

              {error && (
                <p className="mt-2 text-xs text-red-400">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full bg-[#1a2332] hover:bg-[#243044] disabled:bg-[#151B23] disabled:text-zinc-600 text-zinc-200 font-medium rounded-lg px-4 py-3 transition-colors focus:outline-none focus:ring-2 focus:ring-[#3d4a5c] focus:ring-offset-2 focus:ring-offset-[#11161D]"
            >
              {isLoading ? 'Signing in...' : 'Enter POS'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-6">
          Local Inventory System
        </p>
      </div>
    </div>
  );
}
