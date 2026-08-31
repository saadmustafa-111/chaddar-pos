'use client';

import {
  BusinessProfile,
} from '../../settings/api/business-profile';
import {
  SaleWithItems,
  salePaymentStatusLabels,
} from '../api/sales';
import { formatDate, formatPaisa, formatWeight } from '../../shared/utils/format';

interface Props {
  sale: SaleWithItems['sale'];
  items: SaleWithItems['items'];
  business: BusinessProfile | null;
}

export function InvoiceDocument({ sale, items, business }: Props) {
  const totalPieces = items.reduce((sum, i) => sum + i.piecesSold, 0);
  const totalWeight = items.reduce(
    (sum, i) => sum + Number(i.weightSoldKg),
    0,
  );

  return (
    <div className="bg-white text-zinc-900 p-8 max-w-3xl mx-auto print:p-6 print:max-w-none print:shadow-none">
      <header className="flex items-start justify-between border-b border-zinc-300 pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            {business?.shopName?.trim() || 'SteelCoil POS'}
          </h1>
          {business?.address && (
            <p className="text-sm text-zinc-600 mt-1">{business.address}</p>
          )}
          <div className="text-sm text-zinc-600 mt-1 space-x-2">
            {business?.phone && <span>{business.phone}</span>}
            {business?.phone && business?.taxNumber && <span>·</span>}
            {business?.taxNumber && <span>Tax: {business.taxNumber}</span>}
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-semibold text-zinc-900">INVOICE</h2>
          <p className="text-sm text-zinc-600 mt-1">
            <span className="font-medium text-zinc-900">No:</span> {sale.code}
          </p>
          <p className="text-sm text-zinc-600">
            <span className="font-medium text-zinc-900">Date:</span>{' '}
            {formatDate(sale.saleDate)}
          </p>
          <p className="text-sm mt-1">
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                sale.paymentStatus === 'PAID'
                  ? 'bg-green-100 text-green-700'
                  : sale.paymentStatus === 'PARTIAL'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
              }`}
            >
              {salePaymentStatusLabels[sale.paymentStatus]}
            </span>
          </p>
        </div>
      </header>

      <section className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">
          Bill To
        </h3>
        {sale.customer ? (
          <div className="text-sm">
            <div className="font-medium text-zinc-900">{sale.customer.name}</div>
            {sale.customer.phone && (
              <div className="text-zinc-700">{sale.customer.phone}</div>
            )}
          </div>
        ) : (
          <div className="text-sm text-zinc-700 italic">Cash sale</div>
        )}
      </section>

      <table className="w-full text-sm border-collapse mb-6">
        <thead>
          <tr className="border-b-2 border-zinc-300 text-left text-xs uppercase tracking-wide text-zinc-600">
            <th className="py-2">Item / Size</th>
            <th className="py-2 text-right">Pieces</th>
            <th className="py-2 text-right">Weight (KG)</th>
            <th className="py-2 text-right">Rate / KG</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-zinc-200">
              <td className="py-2 font-medium text-zinc-900">
                {item.sizeLabel}
              </td>
              <td className="py-2 text-right text-zinc-700">
                {item.piecesSold}
              </td>
              <td className="py-2 text-right text-zinc-700">
                {formatWeight(Number(item.weightSoldKg))}
              </td>
              <td className="py-2 text-right text-zinc-700">
                {formatPaisa(Number(item.sellingRatePaisa))}
              </td>
              <td className="py-2 text-right font-semibold text-zinc-900">
                {formatPaisa(Number(item.lineRevenuePaisa))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-zinc-300">
            <td className="py-2 font-medium text-zinc-900">Total</td>
            <td className="py-2 text-right text-zinc-900 font-medium">
              {totalPieces}
            </td>
            <td className="py-2 text-right text-zinc-900 font-medium">
              {formatWeight(totalWeight)}
            </td>
            <td className="py-2"></td>
            <td className="py-2 text-right text-zinc-900 font-medium">
              {formatPaisa(Number(sale.totalAmountPaisa))}
            </td>
          </tr>
        </tfoot>
      </table>

      <section className="ml-auto max-w-xs text-sm space-y-1 mb-6">
        <div className="flex justify-between border-t border-zinc-200 pt-2">
          <span className="text-zinc-600">Grand Total</span>
          <span className="font-semibold text-zinc-900">
            {formatPaisa(Number(sale.totalAmountPaisa))}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">Paid</span>
          <span className="text-zinc-900">
            {formatPaisa(Number(sale.paidAmountPaisa))}
          </span>
        </div>
        <div className="flex justify-between border-t border-zinc-300 pt-1">
          <span className="text-zinc-700 font-medium">Due</span>
          <span
            className={`font-semibold ${
              Number(sale.dueAmountPaisa) > 0
                ? 'text-red-700'
                : 'text-zinc-900'
            }`}
          >
            {formatPaisa(Number(sale.dueAmountPaisa))}
          </span>
        </div>
      </section>

      {sale.note && (
        <section className="text-sm text-zinc-700 border-t border-zinc-200 pt-3 mb-4">
          <span className="font-medium text-zinc-900">Note:</span> {sale.note}
        </section>
      )}

      <footer className="text-center text-sm text-zinc-600 border-t border-zinc-300 pt-4 mt-6">
        {business?.footerMessage?.trim() ||
          'Thank you for your business.'}
      </footer>
    </div>
  );
}