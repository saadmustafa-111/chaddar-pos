import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the supplier financial ledger.
 *
 * `supplier_ledger_entries` is the single source of truth for the
 * amounts a supplier has sold to us (PURCHASE_DUE) and how much we
 * have paid back (PAYMENT). ADJUSTMENT is reserved for future manual
 * corrections.
 *
 * For every pre-existing purchase we back-fill one PURCHASE_DUE entry
 * per coil so the running totals match reality. The migration uses
 * the `created_at` timestamp of each purchase for the entry date so
 * historical payments stay easy to audit.
 */
export class CreateSupplierLedgerAndBackfill1723843201200 implements MigrationInterface {
  name = 'CreateSupplierLedgerAndBackfill1723843201200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "supplier_ledger_entries" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "supplier_id" integer NOT NULL,
        "purchase_id" integer,
        "entry_type" varchar(20) NOT NULL,
        "amount_paisa" bigint NOT NULL,
        "balance_after_paisa" bigint NOT NULL DEFAULT 0,
        "entry_date" date NOT NULL,
        "note" text,
        "created_by" varchar(100),
        "created_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "fk_supplier_ledger_supplier"
          FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_supplier_ledger_purchase"
          FOREIGN KEY ("purchase_id") REFERENCES "purchases" ("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_supplier_ledger_supplier_id" ON "supplier_ledger_entries" ("supplier_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_supplier_ledger_purchase_id" ON "supplier_ledger_entries" ("purchase_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_supplier_ledger_entry_date" ON "supplier_ledger_entries" ("entry_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_supplier_ledger_entry_type" ON "supplier_ledger_entries" ("entry_type")`,
    );

    // Back-fill one PURCHASE_DUE entry per existing coil so the
    // historical balance for every supplier matches what the shop
    // actually owes them. We compute the running balance per supplier
    // ordered by purchase creation date so the back-fill is
    // deterministic.
    const coils = (await queryRunner.query(
      `SELECT c.id, c.purchase_id, c.purchase_amount_paisa, c.supplier_id, p.purchase_date, p.created_at, p.code
       FROM coils c
       JOIN purchases p ON p.id = c.purchase_id
       ORDER BY p.created_at ASC, c.id ASC`,
    )) as Array<{
      id: number;
      purchase_id: number;
      purchase_amount_paisa: number | string;
      supplier_id: number;
      purchase_date: string;
      created_at: string;
      code: string;
    }>;

    interface RunningBalance {
      balance: number;
    }
    const balances = new Map<number, RunningBalance>();

    for (const coil of coils) {
      const amount = Number(coil.purchase_amount_paisa);
      if (!Number.isFinite(amount) || amount === 0) continue;
      const supplierId = Number(coil.supplier_id);
      const running = balances.get(supplierId) ?? { balance: 0 };
      const nextBalance = running.balance + amount;
      const entryDate = (
        coil.purchase_date ??
        coil.created_at ??
        new Date().toISOString().slice(0, 10)
      ).slice(0, 10);
      await queryRunner.query(
        `INSERT INTO "supplier_ledger_entries"
           (supplier_id, purchase_id, entry_type, amount_paisa, balance_after_paisa, entry_date, note, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [
          supplierId,
          coil.purchase_id,
          'PURCHASE_DUE',
          amount,
          nextBalance,
          entryDate,
          `Back-filled from purchase ${coil.code}`,
          coil.created_at,
        ],
      );
      balances.set(supplierId, { balance: nextBalance });
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_supplier_ledger_entry_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_supplier_ledger_entry_date"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_supplier_ledger_purchase_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_supplier_ledger_supplier_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "supplier_ledger_entries"`);
  }
}
