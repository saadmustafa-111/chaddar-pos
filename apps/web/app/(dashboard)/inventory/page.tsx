'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FinishedStockFacets,
  FinishedStockFilters,
  FinishedStockRow,
  InventorySummary,
  RawCoilFilters,
  RawCoilRow,
  coilStatusColors,
  coilStatusLabels,
  finishedStockStatusColors,
  finishedStockStatusLabels,
  inventoryApi,
} from '../../../features/inventory/api/inventory';
import {
  formatPaisa,
  formatWeight,
} from '../../../features/shared/utils/format';
import {
  ErrorBanner,
  LoadingState,
  PrimaryButton,
  SectionCard,
  SelectInput,
  StatusBadge,
  SummaryTile,
  TextInput,
  FormField,
  EmptyState,
  DataTable,
  TBody,
  TR,
  TD,
} from '../../../features/ui';
import { PriceCategory } from '../../../features/price-categories/api/price-categories';
import { priceCategoriesApi } from '../../../features/price-categories/api/price-categories';
import Link from 'next/link';

type Tab = 'finished' | 'raw';

export default function InventoryOverviewPage() {
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [finishedRows, setFinishedRows] = useState<FinishedStockRow[]>([]);
  const [rawRows, setRawRows] = useState<RawCoilRow[]>([]);
  const [facets, setFacets] = useState<FinishedStockFacets>({
    sizeLabels: [],
    thicknessMm: [],
  });
  const [categories, setCategories] = useState<PriceCategory[]>([]);
  const [tab, setTab] = useState<Tab>('finished');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [finishedFilters, setFinishedFilters] = useState<FinishedStockFilters>({
    includeSoldOut: false,
  });
  const [rawFilters, setRawFilters] = useState<RawCoilFilters>({});

  const loadAll = useCallback(async () => {
    try {
      const [summaryData, finished, raw, facetData, cats] = await Promise.all([
        inventoryApi.summary(),
        inventoryApi.finishedStock(finishedFilters),
        inventoryApi.rawCoils(rawFilters),
        inventoryApi.finishedStockFacets(),
        priceCategoriesApi.findAll(),
      ]);
      setSummary(summaryData);
      setFinishedRows(finished);
      setRawRows(raw);
      setFacets(facetData);
      setCategories(cats);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load inventory',
      );
    } finally {
      setIsLoading(false);
    }
  }, [finishedFilters, rawFilters]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsLoading(true);
    });
    (async () => {
      try {
        const [summaryData, finished, raw, facetData, cats] = await Promise.all([
          inventoryApi.summary(),
          inventoryApi.finishedStock(finishedFilters),
          inventoryApi.rawCoils(rawFilters),
          inventoryApi.finishedStockFacets(),
          priceCategoriesApi.findAll(),
        ]);
        if (cancelled) return;
        setSummary(summaryData);
        setFinishedRows(finished);
        setRawRows(raw);
        setFacets(facetData);
        setCategories(cats);
        setError('');
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Failed to load inventory',
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [finishedFilters, rawFilters]);

  const filteredFinished = useMemo(() => {
    const filtered = finishedRows.filter((row) => {
      if (!finishedFilters.includeSoldOut && row.status === 'SOLD_OUT') {
        return false;
      }
      return true;
    });
    return filtered;
  }, [finishedRows, finishedFilters.includeSoldOut]);

  const filteredRaw = useMemo(() => {
    const search = (rawFilters.search ?? '').toLowerCase();
    if (!search) return rawRows;
    return rawRows.filter((row) => {
      return (
        row.code.toLowerCase().includes(search) ||
        (row.batchNumber?.toLowerCase().includes(search) ?? false) ||
        (row.supplierName?.toLowerCase().includes(search) ?? false) ||
        (row.priceCategoryName?.toLowerCase().includes(search) ?? false)
      );
    });
  }, [rawRows, rawFilters.search]);

  if (isLoading && !summary) {
    return <LoadingState message="Loading inventory…" />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            Total Inventory
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Real backend-derived stock picture. Numbers refresh after every
            purchase, cutting, sale, wastage or adjustment.
          </p>
        </div>
        <PrimaryButton type="button" onClick={loadAll}>
          Refresh
        </PrimaryButton>
      </div>

      {error && <ErrorBanner message={error} />}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <SummaryTile
            label="Raw Coil Weight"
            value={formatWeight(summary.rawCoils.totalCurrentWeightKg)}
            helper={`${summary.rawCoils.activeCoils} active · ${summary.rawCoils.depletedCoils} depleted`}
          />
          <SummaryTile
            label="Finished Chaddar"
            value={formatWeight(summary.finishedChaddar.totalRemainingWeightKg)}
            helper={`${summary.finishedChaddar.sellableRows + summary.finishedChaddar.partialRows} stock rows`}
          />
          <SummaryTile
            label="Finished Pieces"
            value={summary.finishedChaddar.totalRemainingPieces.toLocaleString()}
            helper="Available + partial stock"
          />
          <SummaryTile
            label="Available Stock KG"
            value={formatWeight(summary.finishedChaddar.totalRemainingWeightKg)}
            variant="highlight"
            helper="Sellable weight across all stock"
          />
          <SummaryTile
            label="Finished Stock Cost Value"
            value={formatPaisa(summary.finishedChaddar.totalFinishedCostValuePaisa)}
            variant="default"
            helper="Remaining weight × finished cost/KG"
          />
        </div>
      )}

      <div className="bg-[#141A22] border border-zinc-800 rounded-xl p-1 inline-flex">
        <button
          type="button"
          onClick={() => setTab('finished')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'finished'
              ? 'bg-zinc-100 text-zinc-900'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Finished Chaddar
        </button>
        <button
          type="button"
          onClick={() => setTab('raw')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'raw'
              ? 'bg-zinc-100 text-zinc-900'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Raw Coils
        </button>
      </div>

      {tab === 'finished' ? (
        <SectionCard
          title="Finished Chaddar Stock"
          description="Live, filtered by category, size, gauge and status. Sold-out stock is hidden by default."
        >
          <div className="p-6 border-b border-zinc-800 grid grid-cols-1 md:grid-cols-12 gap-3">
            <FormField label="Search" className="md:col-span-3">
              <TextInput
                value={finishedFilters.search ?? ''}
                onChange={(e) =>
                  setFinishedFilters((prev) => ({
                    ...prev,
                    search: e.target.value,
                  }))
                }
                placeholder="Code, heat number, size, color…"
              />
            </FormField>
            <FormField label="Category" className="md:col-span-2">
              <SelectInput
                value={finishedFilters.categoryId ?? ''}
                onChange={(e) =>
                  setFinishedFilters((prev) => ({
                    ...prev,
                    categoryId: e.target.value
                      ? parseInt(e.target.value, 10)
                      : undefined,
                  }))
                }
              >
                <option value="">All</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Size" className="md:col-span-2">
              <SelectInput
                value={finishedFilters.sizeLabel ?? ''}
                onChange={(e) =>
                  setFinishedFilters((prev) => ({
                    ...prev,
                    sizeLabel: e.target.value || undefined,
                  }))
                }
              >
                <option value="">All</option>
                {facets.sizeLabels.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Gauge (mm)" className="md:col-span-2">
              <SelectInput
                value={
                  finishedFilters.thicknessMm === '' ||
                  finishedFilters.thicknessMm == null
                    ? ''
                    : String(finishedFilters.thicknessMm)
                }
                onChange={(e) =>
                  setFinishedFilters((prev) => ({
                    ...prev,
                    thicknessMm:
                      e.target.value === '' ? '' : Number(e.target.value),
                  }))
                }
              >
                <option value="">All</option>
                {facets.thicknessMm.map((t) => (
                  <option key={t} value={t}>
                    {t.toFixed(3)}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Status" className="md:col-span-2">
              <SelectInput
                value={finishedFilters.status ?? ''}
                onChange={(e) =>
                  setFinishedFilters((prev) => ({
                    ...prev,
                    status:
                      (e.target.value as
                        | 'AVAILABLE'
                        | 'PARTIALLY_SOLD'
                        | 'SOLD_OUT'
                        | 'CANCELLED'
                        | '') || '',
                  }))
                }
              >
                <option value="">All</option>
                <option value="AVAILABLE">Available</option>
                <option value="PARTIALLY_SOLD">Partially Sold</option>
                <option value="SOLD_OUT">Sold Out</option>
              </SelectInput>
            </FormField>
            <div className="md:col-span-1 flex items-end">
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={finishedFilters.includeSoldOut ?? false}
                  onChange={(e) =>
                    setFinishedFilters((prev) => ({
                      ...prev,
                      includeSoldOut: e.target.checked,
                    }))
                  }
                  className="rounded border-zinc-700 bg-[#0D1117]"
                />
                Sold-out
              </label>
            </div>
          </div>

          <DataTable
            headers={[
              { label: 'Stock' },
              { label: 'Heat #' },
              { label: 'Category' },
              { label: 'Size' },
              { label: 'Gauge', align: 'right' },
              { label: 'Available Pieces', align: 'right' },
              { label: 'Available KG', align: 'right' },
              { label: 'Cost / KG', align: 'right' },
              { label: 'Cost Value', align: 'right' },
              { label: 'Status' },
            ]}
          >
            <TBody>
              {filteredFinished.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-0">
                    <EmptyState
                      title="No finished stock matches"
                      description="Adjust filters or cut a new batch to see results."
                    />
                  </td>
                </tr>
              ) : (
                filteredFinished.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <div className="text-sm font-medium text-zinc-100">
                        {row.code}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        Coil: {row.sourceCoilCode ?? `#${row.sourceCoilId}`}
                      </div>
                    </TD>
                    <TD>
                      <div className="text-sm font-mono text-yellow-400">
                        {row.heatNumber ?? '—'}
                      </div>
                    </TD>
                    <TD>
                      {row.priceCategoryName ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                          <span className="text-zinc-100 font-medium">
                            {row.priceCategoryName}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500">
                          Unassigned
                        </span>
                      )}
                    </TD>
                    <TD className="text-sm text-zinc-100">{row.sizeLabel}</TD>
                    <TD align="right" className="text-sm text-zinc-300">
                      {row.thicknessMm != null
                        ? `${Number(row.thicknessMm).toFixed(3)} mm`
                        : '—'}
                    </TD>
                    <TD align="right" className="text-sm font-medium text-zinc-100">
                      {row.remainingPieces}
                    </TD>
                    <TD align="right" className="text-sm font-medium text-zinc-100">
                      {formatWeight(row.remainingWeightKg)}
                    </TD>
                    <TD align="right" className="text-sm text-zinc-300">
                      {formatPaisa(row.finishedCostPerKgPaisa)}
                    </TD>
                    <TD align="right" className="text-sm text-zinc-300">
                      {formatPaisa(row.remainingCostValuePaisa)}
                    </TD>
                    <TD>
                      <StatusBadge variant={finishedStockStatusColors[row.status]}>
                        {finishedStockStatusLabels[row.status]}
                      </StatusBadge>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </DataTable>
        </SectionCard>
      ) : (
        <SectionCard
          title="Raw Coils"
          description="Raw material on hand. Cutting and sales never touch this weight — sales only reduce finished stock."
        >
          <div className="p-6 border-b border-zinc-800 grid grid-cols-1 md:grid-cols-12 gap-3">
            <FormField label="Search" className="md:col-span-4">
              <TextInput
                value={rawFilters.search ?? ''}
                onChange={(e) =>
                  setRawFilters((prev) => ({
                    ...prev,
                    search: e.target.value,
                  }))
                }
                placeholder="Coil #, batch, supplier…"
              />
            </FormField>
            <FormField label="Category" className="md:col-span-3">
              <SelectInput
                value={rawFilters.categoryId ?? ''}
                onChange={(e) =>
                  setRawFilters((prev) => ({
                    ...prev,
                    categoryId: e.target.value
                      ? parseInt(e.target.value, 10)
                      : undefined,
                  }))
                }
              >
                <option value="">All</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Status" className="md:col-span-2">
              <SelectInput
                value={rawFilters.status ?? ''}
                onChange={(e) =>
                  setRawFilters((prev) => ({
                    ...prev,
                    status:
                      (e.target.value as
                        | 'RAW'
                        | 'IN_PROCESS'
                        | 'FINISHED'
                        | 'DEPLETED'
                        | '') || '',
                  }))
                }
              >
                <option value="">All</option>
                <option value="RAW">Raw</option>
                <option value="IN_PROCESS">In Process</option>
                <option value="FINISHED">Finished</option>
                <option value="DEPLETED">Depleted</option>
              </SelectInput>
            </FormField>
          </div>

          <DataTable
            headers={[
              { label: 'Coil' },
              { label: 'Supplier' },
              { label: 'Category' },
              { label: 'Gauge (mm)', align: 'right' },
              { label: 'Current KG', align: 'right' },
              { label: 'Wastage KG', align: 'right' },
              { label: 'Cost Value', align: 'right' },
              { label: 'Status' },
            ]}
          >
            <TBody>
              {filteredRaw.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-0">
                    <EmptyState
                      title="No raw coils match"
                      description="Adjust filters or record a purchase to add coils."
                    />
                  </td>
                </tr>
              ) : (
                filteredRaw.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <Link
                        href={`/inventory/raw-coils/${row.id}`}
                        className="text-sm font-medium text-zinc-100 hover:text-zinc-300 underline decoration-dotted underline-offset-2"
                      >
                        {row.code}
                      </Link>
                      {row.batchNumber && (
                        <div className="text-xs text-zinc-500 mt-0.5">
                          Batch {row.batchNumber}
                        </div>
                      )}
                    </TD>
                    <TD className="text-sm text-zinc-400">
                      {row.supplierName ?? '—'}
                    </TD>
                    <TD>
                      {row.priceCategoryName ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                          <span className="text-zinc-100 font-medium">
                            {row.priceCategoryName}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500">Unassigned</span>
                      )}
                    </TD>
                    <TD align="right" className="text-sm text-zinc-300">
                      {row.thicknessMm != null
                        ? `${Number(row.thicknessMm).toFixed(3)} mm`
                        : '—'}
                    </TD>
                    <TD align="right" className="text-sm font-medium text-zinc-100">
                      {formatWeight(row.currentWeight)}
                    </TD>
                    <TD align="right" className="text-sm text-zinc-300">
                      {formatWeight(row.wastageWeight)}
                    </TD>
                    <TD align="right" className="text-sm text-zinc-300">
                      {formatPaisa(row.purchaseAmountPaisa)}
                    </TD>
                    <TD>
                      <StatusBadge variant={coilStatusColors[row.status]}>
                        {coilStatusLabels[row.status]}
                      </StatusBadge>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </DataTable>
        </SectionCard>
      )}
    </div>
  );
}
