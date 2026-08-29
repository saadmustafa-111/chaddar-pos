'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CreateSaleRequest,
  FinishedChaddarStock,
  FinishedChaddarStatus,
  deriveDefaultSellingRatePaisa,
  deriveSoldWeightKg,
  salesApi,
} from '../api/sales';
import {
  formatPaisa,
  formatWeight,
  parseRupeeInput,
  parseWeightInput,
} from '../../shared/utils/format';
import { formatCategoryRate } from '../../price-categories/api/price-categories';
import { CustomerSelector } from '../../customers/components/CustomerSelector';
import { Customer, customersApi } from '../../customers/api/customers';
import { NewCustomerModal } from '../../customers/components/NewCustomerModal';
import {
  PrimaryButton,
  SummaryTile,
  StatRow,
  EmptyState,
  InlineError,
  InlineInfo,
} from '../../ui';

interface Props {
  availableStock: FinishedChaddarStock[];
  preselectedStockId?: string | null;
  onCreated: () => void;
}

interface CartLine {
  /** Stable per-line id (independent of the stock's DB id so the same
   *  stock can never be added twice). */
  uid: string;
  stockId: number;
  pieces: string;
  weightOverride: { value: string; enabled: boolean };
  rateOverride: { value: string; enabled: boolean };
}

type PaymentMode = 'cash' | 'credit';
interface CartState {
  lines: CartLine[];
  paymentMode: PaymentMode;
  customerId: number | null;
  paidAmount: string;
  paidEdited: boolean;
  saleDate: string;
  note: string;
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function newUid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function emptyCart(): CartState {
  return {
    lines: [],
    paymentMode: 'cash',
    customerId: null,
    paidAmount: '',
    paidEdited: false,
    saleDate: todayIso(),
    note: '',
  };
}

/** Build a new CartLine for a stock with sensible defaults seeded in. */
function buildLine(
  stock: FinishedChaddarStock,
  pieces = 1,
): CartLine {
  return {
    uid: newUid(),
    stockId: stock.id,
    pieces: String(pieces),
    weightOverride: { value: '', enabled: false },
    rateOverride: {
      value: deriveDefaultSellingRatePaisa(stock) > 0
        ? (deriveDefaultSellingRatePaisa(stock) / 100).toFixed(2)
        : '',
      enabled: false,
    },
  };
}

const STOCK_FILTER_ALL = 'ALL';
type StockFilterValue = typeof STOCK_FILTER_ALL | string;

interface LineSummary {
  stock: FinishedChaddarStock;
  pieces: number;
  weightKg: number;
  weightLabel: string;
  ratePaisa: number;
  rateLabel: string;
  revenuePaisa: number;
  remainingPieces: number;
}

function computeLineSummary(
  line: CartLine,
  stock: FinishedChaddarStock,
): LineSummary {
  const pieces = Math.max(0, parseInt(line.pieces || '0', 10));
  const wpp =
    stock.weightPerPieceKg != null ? Number(stock.weightPerPieceKg) : 0;

  let weightKg: number;
  let weightLabel: string;
  if (line.weightOverride.enabled) {
    weightKg = parseWeightInput(line.weightOverride.value);
    weightLabel = 'Manual override';
  } else {
    weightKg = deriveSoldWeightKg(stock, pieces);
    weightLabel = wpp > 0 ? `${pieces} pc × ${wpp.toFixed(3)} KG` : '—';
  }

  let ratePaisa: number;
  let rateLabel: string;
  if (line.rateOverride.enabled) {
    ratePaisa = parseRupeeInput(line.rateOverride.value);
    rateLabel = 'Custom rate';
  } else {
    ratePaisa = deriveDefaultSellingRatePaisa(stock);
    rateLabel = stock.priceCategory
      ? `Category default (${stock.priceCategory.name})`
      : 'No category rate';
  }

  const revenuePaisa =
    weightKg > 0 && ratePaisa > 0
      ? Math.round(weightKg * ratePaisa)
      : 0;

  return {
    stock,
    pieces,
    weightKg,
    weightLabel,
    ratePaisa,
    rateLabel,
    revenuePaisa,
    remainingPieces: Math.max(0, stock.remainingPieces - pieces),
  };
}

export function NewSaleForm({
  availableStock,
  preselectedStockId,
  onCreated,
}: Props) {
  const [cart, setCart] = useState<CartState>(() => {
    if (preselectedStockId) {
      // Seed a single stock line when arriving via the "Sell from this"
      // shortcut on the inventory list. The stock itself is provided
      // by the parent and we resolve it lazily below via the lookup.
      return {
        ...emptyCart(),
        lines: [
          {
            uid: newUid(),
            stockId: Number(preselectedStockId),
            pieces: '',
            weightOverride: { value: '', enabled: false },
            rateOverride: { value: '', enabled: false },
          },
        ],
      };
    }
    return emptyCart();
  });
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  // Keep a local copy of the currently selected customer so we can
  // surface their live outstanding balance next to the payment area
  // before the customer selector re-fetches (it only fetches on
  // mount). Refreshed whenever the user picks a different row.
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    if (cart.customerId === null) {
      setSelectedCustomer(null);
      return;
    }
    const targetId = cart.customerId;
    (async () => {
      try {
        const c = await customersApi.findOne(targetId);
        if (!cancelled) setSelectedCustomer(c);
      } catch {
        if (!cancelled) setSelectedCustomer(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cart.customerId]);

  const refreshCustomerAfterPayment = useCallback(
    async (customerId: number) => {
      try {
        const c = await customersApi.findOne(customerId);
        setSelectedCustomer(c);
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCategory, setPickerCategory] = useState<StockFilterValue>(
    STOCK_FILTER_ALL,
  );

  const stockById = useMemo(() => {
    const map = new Map<number, FinishedChaddarStock>();
    for (const s of availableStock) map.set(s.id, s);
    return map;
  }, [availableStock]);

  const inCartStockIds = useMemo(() => {
    const set = new Set<number>();
    for (const line of cart.lines) set.add(line.stockId);
    return set;
  }, [cart.lines]);

  const filteredPicker = useMemo(() => {
    const term = pickerSearch.trim().toLowerCase();
    const matched = availableStock.filter((s) => {
      // The picker must never offer sold-out stock and must never
      // double-add a stock the operator already pulled into the cart.
      if (s.status === FinishedChaddarStatus.SOLD_OUT) return false;
      if (s.status === FinishedChaddarStatus.CANCELLED) return false;
      if (inCartStockIds.has(s.id)) return false;
      if (pickerCategory !== STOCK_FILTER_ALL) {
        if (!s.priceCategory) return false;
        if (String(s.priceCategory.id) !== pickerCategory) return false;
      }
      if (!term) return true;
      const wpp =
        s.weightPerPieceKg != null ? Number(s.weightPerPieceKg) : null;
      const fields = [
        s.code,
        s.heatNumber ?? '',
        s.sizeLabel,
        s.color ?? '',
        s.brand ?? '',
        s.thicknessMm != null ? `${Number(s.thicknessMm).toFixed(3)}` : '',
        s.priceCategory?.name ?? '',
        s.priceCategory?.code ?? '',
        wpp != null && wpp > 0 ? `${wpp.toFixed(2)} KG/pc` : '',
      ];
      return fields.some((field) => field.toLowerCase().includes(term));
    });
    if (!term) return matched;
    return matched.sort((a, b) => {
      const aExact = a.heatNumber?.toLowerCase() === term ? 0 : 1;
      const bExact = b.heatNumber?.toLowerCase() === term ? 0 : 1;
      return aExact - bExact;
    });
  }, [availableStock, inCartStockIds, pickerCategory, pickerSearch]);

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of availableStock) {
      if (s.priceCategory) {
        map.set(String(s.priceCategory.id), s.priceCategory.name);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [availableStock]);

  const summaries: LineSummary[] = useMemo(
    () =>
      cart.lines.flatMap((line) => {
        const stock = stockById.get(line.stockId);
        if (!stock) return [];
        return [computeLineSummary(line, stock)];
      }),
    [cart.lines, stockById],
  );

  const totals = useMemo(() => {
    let pieces = 0;
    let weight = 0;
    let revenue = 0;
    for (const s of summaries) {
      pieces += s.pieces;
      weight += s.weightKg;
      revenue += s.revenuePaisa;
    }
    return { pieces, weight, revenue };
  }, [summaries]);

  const paidPaisa = useMemo(() => {
    if (cart.paidEdited) return parseRupeeInput(cart.paidAmount);
    if (cart.paymentMode === 'cash') return totals.revenue;
    return parseRupeeInput(cart.paidAmount);
  }, [cart.paidAmount, cart.paidEdited, cart.paymentMode, totals.revenue]);

  const duePaisa = Math.max(0, totals.revenue - paidPaisa);
  const overpayment = totals.revenue > 0 && paidPaisa > totals.revenue;

  const lineValidations = useMemo(() => {
    const errors: Record<string, string | null> = {};
    for (const s of summaries) {
      if (s.pieces <= 0) {
        errors[s.stock.id + ':pieces'] = 'Enter at least one piece.';
      } else if (s.pieces > s.stock.remainingPieces) {
        errors[s.stock.id + ':pieces'] =
          `Only ${s.stock.remainingPieces} pieces available.`;
      }
      if (s.weightKg <= 0 && s.pieces > 0) {
        errors[s.stock.id + ':weight'] =
          'Sold weight is zero. Use Adjust Weight or check Weight per Piece.';
      }
      if (
        s.weightKg > 0 &&
        s.weightKg > Number(s.stock.remainingWeightKg) + 0.0005
      ) {
        errors[s.stock.id + ':weight'] =
          `Only ${Number(s.stock.remainingWeightKg).toFixed(3)} KG available.`;
      }
    }
    return errors;
  }, [summaries]);

  const hasBlockingError = Object.values(lineValidations).some((v) => v);
  const cashUnderpaid =
    cart.paymentMode === 'cash' && totals.revenue > 0 && paidPaisa !== totals.revenue;

  const submitDisabled =
    isSaving ||
    cart.lines.length === 0 ||
    totals.weight <= 0 ||
    totals.revenue <= 0 ||
    hasBlockingError ||
    overpayment ||
    cashUnderpaid ||
    (cart.paymentMode === 'credit' && !cart.customerId);

  const addStock = useCallback(
    (stock: FinishedChaddarStock) => {
      setCart((prev) => ({
        ...prev,
        lines: [...prev.lines, buildLine(stock)],
      }));
    },
    [],
  );

  const removeLine = useCallback((uid: string) => {
    setCart((prev) => ({
      ...prev,
      lines: prev.lines.filter((l) => l.uid !== uid),
    }));
  }, []);

  const updateLine = useCallback(
    <K extends keyof CartLine>(
      uid: string,
      field: K,
      value: CartLine[K],
    ) => {
      setCart((prev) => ({
        ...prev,
        lines: prev.lines.map((l) => (l.uid === uid ? { ...l, [field]: value } : l)),
      }));
    },
    [],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (cart.lines.length === 0) {
      setError('Add at least one stock to the sale.');
      return;
    }
    if (totals.weight <= 0 || totals.revenue <= 0) {
      setError('Pieces or weights are invalid. Check the cart.');
      return;
    }
    if (cart.paymentMode === 'credit' && !cart.customerId) {
      setError('Select a customer for credit sales.');
      return;
    }

    const payload: CreateSaleRequest = {
      customerId: cart.customerId ?? undefined,
      paidAmountPaisa: paidPaisa,
      saleDate: cart.saleDate,
      note: cart.note.trim() || undefined,
      // Fresh UUID per submit attempt. The server uses this to dedupe
      // an accidental double-click so finished stock and customer
      // ledger entries are never written twice.
      idempotencyKey:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `sale-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      items: summaries
        .filter((s) => s.pieces > 0 && s.weightKg > 0)
        .map((s) => {
          const item: CreateSaleRequest['items'][number] = {
            finishedStockId: s.stock.id,
            piecesSold: s.pieces,
          };
          const line = cart.lines.find((l) => l.stockId === s.stock.id)!;
          if (line.weightOverride.enabled) {
            item.weightSoldKg = Math.round(s.weightKg * 1000) / 1000;
          }
          if (line.rateOverride.enabled) {
            item.sellingRatePaisa = s.ratePaisa;
          }
          return item;
        }),
    };

    setIsSaving(true);
    try {
      const result = await salesApi.create(payload);
      // For credit sales, refresh the selected customer's ledger so
      // the SalesHistory list and CustomerDetail page reflect the new
      // balance immediately without waiting for a full page reload.
      if (
        cart.paymentMode === 'credit' &&
        cart.customerId &&
        result.sale.customerId === cart.customerId
      ) {
        refreshCustomerAfterPayment(cart.customerId);
      }
      setCart(emptyCart());
      onCreated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to record sale',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = useCallback(() => {
    setCart(emptyCart());
    setPickerSearch('');
    setPickerCategory(STOCK_FILTER_ALL);
    setError('');
  }, []);

  const handlePaymentMode = useCallback((mode: PaymentMode) => {
    setCart((prev) => {
      const next: CartState = { ...prev, paymentMode: mode };
      if (mode === 'cash') {
        // Cash must be fully paid; auto-fill paid amount whenever total
        // changes, unless the operator has manually edited it.
        next.paidAmount =
          next.paidEdited && prev.paidAmount
            ? prev.paidAmount
            : '';
        next.paidEdited = false;
      } else {
        next.paidEdited = false;
        next.paidAmount = '';
      }
      return next;
    });
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ──────────────── Cart Card ──────────────── */}
      <section className="bg-gradient-to-b from-[#141A22] to-[#10141A] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
        <header className="px-6 pt-6 pb-5 border-b border-zinc-800/70">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Cart
          </div>
          <h2 className="mt-1 text-xl font-semibold text-zinc-100">
            Items in this sale
          </h2>
          <p className="mt-1 text-sm text-zinc-400 max-w-2xl">
            One or more finished-stock entries. Sold weight and rate are
            derived automatically — override only when you really need to.
          </p>
        </header>

        {cart.lines.length === 0 ? (
          <div className="px-6 py-10">
            <EmptyState
              title="Cart is empty"
              description="Pick a finished stock below to start the sale."
            />
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/70">
            {summaries.map((s) => {
              const line = cart.lines.find(
                (l) => l.stockId === s.stock.id,
              )!;
              const piecesError =
                lineValidations[s.stock.id + ':pieces'] ?? null;
              const weightError =
                lineValidations[s.stock.id + ':weight'] ?? null;
              return (
                <CartLineRow
                  key={line.uid}
                  summary={s}
                  line={line}
                  piecesError={piecesError}
                  weightError={weightError}
                  onUpdate={updateLine}
                  onRemove={removeLine}
                  disabled={isSaving}
                />
              );
            })}
          </div>
        )}

        {summaries.length > 0 && (
          <footer className="px-6 py-5 bg-[#0D1117]/60 border-t border-zinc-800/70">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryTile
                label="Lines"
                value={String(summaries.length)}
              />
              <SummaryTile label="Pieces" value={String(totals.pieces)} />
              <SummaryTile
                label="Sold Weight"
                value={formatWeight(totals.weight)}
              />
              <SummaryTile
                label="Sale Total"
                value={formatPaisa(totals.revenue)}
                variant="highlight"
              />
            </div>
          </footer>
        )}
      </section>

      {/* ──────────────── Stock Picker ──────────────── */}
      <StockPicker
        title="Add finished stock"
        subtitle="Search, filter by category, then add to the cart. Sold-out stock is hidden automatically."
        stock={filteredPicker}
        allCount={availableStock.length}
        search={pickerSearch}
        onSearchChange={setPickerSearch}
        category={pickerCategory}
        onCategoryChange={setPickerCategory}
        categoryOptions={categoryOptions}
        onPick={addStock}
        disabled={isSaving}
      />

      {/* ──────────────── Customer ──────────────── */}
      <section className="bg-[#141A22] border border-zinc-800/80 rounded-2xl overflow-hidden">
        <div className="px-6 py-5 space-y-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Customer
          </div>
          <CustomerSelector
            value={cart.customerId}
            onChange={(id) =>
              setCart((prev) => ({ ...prev, customerId: id }))
            }
            onCreateNew={() => setShowNewCustomer(true)}
            disabled={isSaving}
          />
          {cart.paymentMode === 'credit' && !cart.customerId && (
            <p className="text-xs text-amber-400">
              Select or create a customer for a credit sale.
            </p>
          )}
        </div>
      </section>

      {/* ──────────────── Payment ──────────────── */}
      <section className="bg-gradient-to-b from-[#141A22] to-[#10141A] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
        <header className="px-6 pt-6 pb-5 border-b border-zinc-800/70">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Payment
          </div>
          <h2 className="mt-1 text-xl font-semibold text-zinc-100">
            How is the customer paying?
          </h2>
          <p className="mt-1 text-sm text-zinc-400 max-w-2xl">
            Cash sales are paid in full. Credit sales record the balance on
            the customer&apos;s ledger automatically.
          </p>
        </header>

        <div className="px-6 py-6 space-y-5">
          <div className="flex flex-wrap gap-2">
            <PaymentModePill
              mode="cash"
              active={cart.paymentMode === 'cash'}
              onClick={() => handlePaymentMode('cash')}
              hint="Fully paid now; optional customer."
              disabled={isSaving}
            />
            <PaymentModePill
              mode="credit"
              active={cart.paymentMode === 'credit'}
              onClick={() => handlePaymentMode('credit')}
              hint="Customer sale — pay now or later."
              disabled={isSaving}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PaymentField
              label={
                cart.paymentMode === 'cash'
                  ? 'Paid Now'
                  : 'Paid Now (Rs)'
              }
              hint={
                cart.paymentMode === 'cash'
                  ? 'Auto = full sale total.'
                  : 'Leave empty to record as full due.'
              }
              value={
                cart.paymentMode === 'cash' && !cart.paidEdited
                  ? (totals.revenue / 100).toFixed(2)
                  : cart.paidAmount
              }
              onChange={(v) => {
                setCart((prev) => ({
                  ...prev,
                  paidAmount: v,
                  paidEdited: v.trim() !== '' || prev.paidEdited,
                }));
              }}
              disabled={isSaving}
              error={overpayment ? 'Paid exceeds sale total' : null}
            />
            <PaymentField
              label="Sale Date"
              type="date"
              value={cart.saleDate}
              onChange={(v) =>
                setCart((prev) => ({ ...prev, saleDate: v }))
              }
              disabled={isSaving}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">
              Note
            </label>
            <textarea
              value={cart.note}
              onChange={(e) =>
                setCart((prev) => ({ ...prev, note: e.target.value }))
              }
              maxLength={500}
              disabled={isSaving}
              rows={2}
              placeholder="Optional"
              className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600 disabled:opacity-60 resize-y"
            />
          </div>

          {totals.revenue > 0 && (
            <div className="rounded-xl bg-[#0D1117] border border-zinc-800 p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <StatRow label="Sale Total" value={formatPaisa(totals.revenue)} />
                <StatRow label="Paid Now" value={formatPaisa(paidPaisa)} />
                <StatRow
                  label={duePaisa > 0 ? 'Remaining Credit' : 'Balance'}
                  value={formatPaisa(duePaisa)}
                  valueClass={
                    duePaisa > 0 ? 'text-yellow-400' : 'text-green-400'
                  }
                  emphasis
                />
              </div>
              {cart.paymentMode === 'credit' && duePaisa > 0 && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300 flex items-start gap-2">
                  <svg
                    className="w-4 h-4 mt-0.5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-2.99l-6.93-12a2 2 0 00-3.48 0l-6.93 12A2 2 0 005.07 19z"
                    />
                  </svg>
                  <div>
                    <div className="font-medium">Credit Sale</div>
                    <div className="text-yellow-300/80 mt-0.5">
                      The remaining Rs {formatPaisa(duePaisa)} will be
                      recorded on{' '}
                      <span className="font-medium">
                        {selectedCustomer?.name ?? 'the customer'}
                      </span>
                      &apos;s ledger.
                    </div>
                  </div>
                </div>
              )}
              {cart.paymentMode === 'credit' &&
                selectedCustomer &&
                Number(selectedCustomer.currentBalancePaisa) > 0 && (
                  <div className="text-xs text-zinc-400">
                    Customer current outstanding: Rs{' '}
                    <span className="text-red-400 font-medium">
                      {(
                        Number(selectedCustomer.currentBalancePaisa) / 100
                      ).toFixed(2)}
                    </span>
                    . After this sale it will be Rs{' '}
                    <span className="text-yellow-300 font-medium">
                      {(
                        (Number(selectedCustomer.currentBalancePaisa) +
                          duePaisa) /
                        100
                      ).toFixed(2)}
                    </span>
                    .
                  </div>
                )}
            </div>
          )}

          {cashUnderpaid && (
            <InlineInfo>
              Cash sales must be fully paid. Total is{' '}
              <span className="font-medium text-zinc-100">
                {formatPaisa(totals.revenue)}
              </span>
              . Switch to <strong>Credit</strong> for partial payment.
            </InlineInfo>
          )}

          {error && <InlineError message={error} />}
        </div>

        <footer className="px-6 py-4 bg-[#0D1117]/60 border-t border-zinc-800/70 flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={isSaving}
            className="text-xs text-zinc-500 hover:text-zinc-300 underline decoration-dotted underline-offset-2 disabled:opacity-50"
          >
            Clear sale
          </button>
          <PrimaryButton
            type="submit"
            disabled={submitDisabled}
            isLoading={isSaving}
            loadingLabel="Saving..."
          >
            Complete Sale
          </PrimaryButton>
        </footer>
      </section>

      <NewCustomerModal
        open={showNewCustomer}
        onClose={() => setShowNewCustomer(false)}
        onSaved={(c) => {
          // Auto-select the freshly created customer and keep every
          // cart line the operator already entered.
          setCart((prev) => ({ ...prev, customerId: c.id }));
          setSelectedCustomer(c);
          setShowNewCustomer(false);
        }}
      />
    </form>
  );
}

/* ───────────────────────── helpers ───────────────────────── */

function PaymentModePill({
  mode,
  active,
  onClick,
  hint,
  disabled,
}: {
  mode: PaymentMode;
  active: boolean;
  onClick: () => void;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex-1 min-w-[12rem] text-left rounded-xl border px-4 py-3 transition-colors disabled:opacity-50 ${
        active
          ? 'bg-yellow-500/10 border-yellow-500/40 ring-1 ring-yellow-500/40'
          : 'bg-[#0D1117] border-zinc-800 hover:border-zinc-700'
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
        {mode === 'cash' ? (
          <svg
            className="w-4 h-4 text-yellow-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 12v-2m0-10c1.11 0 2.08.402 2.599 1M12 6c-1.11 0-2.08.402-2.599 1"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4 text-yellow-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        )}
        {mode === 'cash' ? 'Cash sale' : 'Customer credit'}
      </div>
      <div className="text-xs text-zinc-500 mt-1">{hint}</div>
    </button>
  );
}

function PaymentField({
  label,
  value,
  onChange,
  disabled,
  type = 'number',
  hint,
  error,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  type?: 'number' | 'date';
  hint?: string | null;
  error?: string | null;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-500 mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        min={type === 'number' ? '0' : undefined}
        step={type === 'number' ? '0.01' : undefined}
        className={`w-full bg-[#0D1117] border rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 placeholder:text-zinc-600 disabled:opacity-60 ${
          error ? 'border-red-500/50 focus:ring-red-500/40' : 'border-zinc-700 focus:ring-zinc-600'
        }`}
      />
      {error ? (
        <p className="text-xs text-red-400 mt-1.5">{error}</p>
      ) : hint ? (
        <p className="text-xs text-zinc-600 mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}

function StockPicker({
  title,
  subtitle,
  stock,
  allCount,
  search,
  onSearchChange,
  category,
  onCategoryChange,
  categoryOptions,
  onPick,
  disabled,
}: {
  title: string;
  subtitle: string;
  stock: FinishedChaddarStock[];
  allCount: number;
  search: string;
  onSearchChange: (s: string) => void;
  category: StockFilterValue;
  onCategoryChange: (c: StockFilterValue) => void;
  categoryOptions: Array<[string, string]>;
  onPick: (s: FinishedChaddarStock) => void;
  disabled?: boolean;
}) {
  return (
    <section className="bg-gradient-to-b from-[#141A22] to-[#10141A] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
      <header className="px-6 pt-6 pb-5 border-b border-zinc-800/70">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Step 1
        </div>
        <h2 className="mt-1 text-xl font-semibold text-zinc-100">{title}</h2>
        <p className="mt-1 text-sm text-zinc-400 max-w-2xl">{subtitle}</p>
      </header>

      <div className="px-6 py-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              disabled={disabled}
              placeholder="Stock code, size, thickness, color, category…"
              className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 placeholder:text-zinc-600 disabled:opacity-60"
            />
          </div>
          <div className="md:w-56">
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
              disabled={disabled}
              className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 disabled:opacity-60"
            >
              <option value={STOCK_FILTER_ALL}>All categories</option>
              {categoryOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {stock.length === 0 ? (
          <div className="py-10">
            {allCount === 0 ? (
              <EmptyState
                title="No sellable stock"
                description="Cut a coil into chaddar first to create sellable inventory."
              />
            ) : (
              <EmptyState
                title="Nothing matches"
                description="No stock matches the current filters. Adjust the search or pick a different category."
              />
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {stock.map((s) => (
              <StockCard
                key={s.id}
                stock={s}
                disabled={disabled}
                onPick={onPick}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StockCard({
  stock,
  disabled,
  onPick,
}: {
  stock: FinishedChaddarStock;
  disabled?: boolean;
  onPick: (s: FinishedChaddarStock) => void;
}) {
  const wpp =
    stock.weightPerPieceKg != null ? Number(stock.weightPerPieceKg) : null;
  const ratePaisa = deriveDefaultSellingRatePaisa(stock);
  const gauge =
    stock.thicknessMm != null ? `${Number(stock.thicknessMm).toFixed(2)}mm` : '—';

  const sizeLine = [
    stock.sizeLabel,
    gauge !== '—' ? gauge : null,
    stock.color ?? null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="rounded-xl border border-zinc-800 bg-[#0D1117] p-4 flex flex-col gap-3 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {stock.priceCategory && (
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0" />
            )}
            <span className="text-[11px] uppercase tracking-wider font-medium text-zinc-400 truncate">
              {stock.priceCategory?.name ?? 'Unassigned'}
            </span>
          </div>
          <div className="mt-1 text-sm font-medium text-zinc-100 truncate">
            {stock.code}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5 truncate">
            {sizeLine || '—'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Tile label="Available" value={`${stock.remainingPieces} pc`} />
        <Tile label="Available KG" value={formatWeight(Number(stock.remainingWeightKg))} />
        <Tile
          label="Weight / Piece"
          value={wpp != null && wpp > 0 ? `${wpp.toFixed(2)} KG` : '—'}
        />
        <Tile
          label="Rate / KG"
          value={ratePaisa > 0 ? formatCategoryRate(ratePaisa) : '—'}
        />
      </div>

      <button
        type="button"
        onClick={() => onPick(stock)}
        disabled={disabled || stock.remainingPieces <= 0}
        className="w-full text-sm font-medium bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-900 rounded-lg py-2 transition-colors"
      >
        + Add to sale
      </button>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-[#0B0F14] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium text-zinc-100 truncate">
        {value}
      </div>
    </div>
  );
}

function CartLineRow({
  summary: s,
  line,
  piecesError,
  weightError,
  onUpdate,
  onRemove,
  disabled,
}: {
  summary: LineSummary;
  line: CartLine;
  piecesError: string | null;
  weightError: string | null;
  onUpdate: <K extends keyof CartLine>(
    uid: string,
    field: K,
    value: CartLine[K],
  ) => void;
  onRemove: (uid: string) => void;
  disabled?: boolean;
}) {
  const wpp =
    s.stock.weightPerPieceKg != null ? Number(s.stock.weightPerPieceKg) : null;
  const ratePaisa = deriveDefaultSellingRatePaisa(s.stock);
  const gauge =
    s.stock.thicknessMm != null ? `${Number(s.stock.thicknessMm).toFixed(2)}mm` : '—';
  const sizeLine = [s.stock.sizeLabel, gauge !== '—' ? gauge : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="px-6 py-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider font-medium text-zinc-400">
            {s.stock.priceCategory?.name ?? 'Unassigned category'}
          </div>
          <div className="mt-1 text-sm font-medium text-zinc-100 truncate">
            {s.stock.code} <span className="text-zinc-500">· {sizeLine}</span>
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {wpp != null && wpp > 0 ? `${wpp.toFixed(3)} KG/pc` : 'No weight-per-piece'}{' '}
            · {ratePaisa > 0 ? formatCategoryRate(ratePaisa) : 'No category rate'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRemove(line.uid)}
          disabled={disabled}
          className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-40"
          title="Remove this line"
          aria-label="Remove this line"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">
            Pieces
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={line.pieces}
            onChange={(e) =>
              onUpdate(line.uid, 'pieces', e.target.value)
            }
            disabled={disabled}
            placeholder="0"
            className={`w-full bg-[#0D1117] border rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 placeholder:text-zinc-600 disabled:opacity-60 ${
              piecesError ? 'border-red-500/50 focus:ring-red-500/40' : 'border-zinc-700'
            }`}
          />
          {piecesError ? (
            <p className="text-xs text-red-400 mt-1.5">{piecesError}</p>
          ) : (
            <p className="text-xs text-zinc-600 mt-1.5">
              Max {s.stock.remainingPieces} available
            </p>
          )}
        </div>
        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">
            Sold Weight
          </label>
          <div className="bg-[#0D1117] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono flex items-center justify-between">
            <span>{formatWeight(s.weightKg)}</span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
              {line.weightOverride.enabled ? 'Override' : 'Auto'}
            </span>
          </div>
          <p
            className={`text-xs mt-1.5 ${
              weightError ? 'text-red-400' : 'text-zinc-600'
            }`}
          >
            {weightError ?? s.weightLabel}
          </p>
        </div>
        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">
            Rate / KG
          </label>
          <div className="bg-[#0D1117] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono flex items-center justify-between">
            <span>
              {s.ratePaisa > 0
                ? `Rs ${(s.ratePaisa / 100).toFixed(2)}`
                : '—'}
            </span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
              {line.rateOverride.enabled ? 'Override' : 'Default'}
            </span>
          </div>
          <p className="text-xs text-zinc-600 mt-1.5">{s.rateLabel}</p>
        </div>
        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">
            Line Total
          </label>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 text-base font-semibold text-yellow-300 font-mono">
            {formatPaisa(s.revenuePaisa)}
          </div>
        </div>
      </div>

      <CartLineOverrides
        line={line}
        stock={s.stock}
        disabled={disabled}
        onUpdate={onUpdate}
        weightError={weightError}
        pieces={s.pieces}
      />
    </div>
  );
}

function CartLineOverrides({
  line,
  stock,
  disabled,
  onUpdate,
  weightError,
  pieces,
}: {
  line: CartLine;
  stock: FinishedChaddarStock;
  disabled?: boolean;
  onUpdate: <K extends keyof CartLine>(
    uid: string,
    field: K,
    value: CartLine[K],
  ) => void;
  weightError: string | null;
  pieces: number;
}) {
  const wpp =
    stock.weightPerPieceKg != null ? Number(stock.weightPerPieceKg) : null;
  const showWeight = line.weightOverride.enabled || Boolean(weightError);
  const showRate = line.rateOverride.enabled;

  if (!showWeight && !showRate) {
    return (
      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() =>
            onUpdate(line.uid, 'weightOverride', {
              value: '',
              enabled: true,
            })
          }
          disabled={disabled || !wpp}
          className="text-zinc-400 hover:text-zinc-100 underline decoration-dotted underline-offset-2 disabled:opacity-40"
        >
          Adjust weight
        </button>
        <span className="text-zinc-700">·</span>
        <button
          type="button"
          onClick={() =>
            onUpdate(line.uid, 'rateOverride', {
              value:
                deriveDefaultSellingRatePaisa(stock) > 0
                  ? (deriveDefaultSellingRatePaisa(stock) / 100).toFixed(2)
                  : '',
              enabled: true,
            })
          }
          disabled={disabled}
          className="text-zinc-400 hover:text-zinc-100 underline decoration-dotted underline-offset-2 disabled:opacity-40"
        >
          Edit rate
        </button>
        {pieces > 0 && wpp === null && (
          <span className="text-yellow-400">
            Stock has no weight-per-piece — adjust weight manually.
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-[#0B0F14] p-3 space-y-3">
      {showWeight && (
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">
            Sold weight override (KG)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.001"
              value={line.weightOverride.value}
              onChange={(e) =>
                onUpdate(line.uid, 'weightOverride', {
                  value: e.target.value,
                  enabled: true,
                })
              }
              disabled={disabled}
              placeholder="0.000"
              className={`flex-1 bg-[#0D1117] border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 placeholder:text-zinc-600 disabled:opacity-60 ${
                weightError ? 'border-red-500/50 focus:ring-red-500/40' : 'border-zinc-700'
              }`}
            />
            <button
              type="button"
              onClick={() =>
                onUpdate(line.uid, 'weightOverride', {
                  value: '',
                  enabled: false,
                })
              }
              disabled={disabled}
              className="text-xs text-zinc-400 hover:text-zinc-100 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Use auto
            </button>
          </div>
        </div>
      )}
      {showRate && (
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">
            Selling rate override (Rs / KG)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={line.rateOverride.value}
              onChange={(e) =>
                onUpdate(line.uid, 'rateOverride', {
                  value: e.target.value,
                  enabled: true,
                })
              }
              disabled={disabled}
              placeholder="0.00"
              className="flex-1 bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 placeholder:text-zinc-600 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() =>
                onUpdate(line.uid, 'rateOverride', {
                  value: '',
                  enabled: false,
                })
              }
              disabled={disabled}
              className="text-xs text-zinc-400 hover:text-zinc-100 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Use default
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
