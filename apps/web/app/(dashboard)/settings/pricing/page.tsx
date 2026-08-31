'use client';

import { useEffect, useState } from 'react';
import { priceCategoriesApi, PriceCategory } from '../../../../features/price-categories/api/price-categories';
import { PriceCategoryTable } from '../../../../features/price-categories/components/PriceCategoryTable';

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<PriceCategory[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      try {
        const data = await priceCategoriesApi.findAll();
        if (!isCancelled) {
          setCategories(data);
        }
      } catch {
        if (!isCancelled) {
          setError('Failed to load price categories');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleUpdated = (updated: PriceCategory) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  };

  const handleDeleted = (id: number) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-100">
          Price Categories
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Manage current purchase and selling rates per kilogram.
          Price categories represent current/default market rates.
          Future transactions will save a snapshot of the rate used at transaction time.
        </p>
      </div>

      {error ? (
        <div className="bg-[#0B0F14] border border-red-500/30 rounded-xl p-6">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : (
        <PriceCategoryTable
          categories={categories}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
