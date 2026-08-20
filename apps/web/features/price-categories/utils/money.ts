export function formatPaisa(paisa: number): string {
  const rupees = paisa / 100;
  return `Rs ${rupees.toFixed(2)}`;
}

export function parseRupeeInput(value: string): number {
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed < 0) {
    return 0;
  }
  return Math.round(parsed * 100);
}
