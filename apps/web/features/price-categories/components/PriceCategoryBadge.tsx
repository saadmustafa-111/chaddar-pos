'use client';

import { formatCategoryRate } from '../api/price-categories';

interface Props {
  category: {
    id: number;
    name: string;
    sellingRatePaisa: number;
    isActive: boolean;
  } | null;
  showSellingRate?: boolean;
}

export function PriceCategoryBadge({ category, showSellingRate }: Props) {
  if (!category) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
        Unassigned
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
      <span className="text-zinc-100 font-medium">{category.name}</span>
      {showSellingRate && (
        <span className="text-zinc-500">
          · {formatCategoryRate(category.sellingRatePaisa)}
        </span>
      )}
    </span>
  );
}