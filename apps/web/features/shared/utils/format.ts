export function formatPaisa(paisa: number): string {
  const rupees = Number(paisa) / 100;
  return `Rs ${rupees.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function parseRupeeInput(value: string): number {
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed < 0) {
    return 0;
  }
  return Math.round(parsed * 100);
}

export function formatWeight(weight: number): string {
  return `${Number(weight).toFixed(3)} KG`;
}

export function parseWeightInput(value: string): number {
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed < 0) {
    return 0;
  }
  return Math.round(parsed * 1000) / 1000;
}

export function calculatePurchaseAmount(
  weight: number,
  ratePaisa: number,
): number {
  const weightNum = Number(weight);
  const rateNum = Number(ratePaisa);
  if (isNaN(weightNum) || isNaN(rateNum) || weightNum <= 0 || rateNum < 0) {
    return 0;
  }
  return Math.round(weightNum * rateNum);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatShortDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
}

export function formatPaisaCompact(paisa: number): string {
  const rupees = Number(paisa) / 100;
  const abs = Math.abs(rupees);
  if (abs >= 1_00_00_000) {
    return `Rs ${(rupees / 1_00_00_000).toFixed(2)} Cr`;
  }
  if (abs >= 1_00_000) {
    return `Rs ${(rupees / 1_00_000).toFixed(2)} L`;
  }
  if (abs >= 1_000) {
    return `Rs ${(rupees / 1_000).toFixed(1)}K`;
  }
  return `Rs ${rupees.toFixed(2)}`;
}