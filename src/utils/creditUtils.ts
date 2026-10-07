import { SaleTransaction, CreditPayment } from '../types';

export interface CustomerDebtorSummary {
  customerName: string;
  totalDebt: number; // Total original credit purchases
  totalPaid: number; // Total payments made
  netBalance: number; // Positive = owes money; Negative = advance deposit credit
  advanceDeposit: number; // Advance credit deposited by customer
  unpaidCount: number; // Number of active unpaid transactions
  latestCreditDate?: string;
  latestPaymentDate?: string;
  unpaidTransactions: SaleTransaction[];
  paidTransactions: SaleTransaction[];
  allTransactions: SaleTransaction[];
  allPayments: CreditPayment[];
}

export function normalizeCustomerName(name?: string): string {
  if (!name) return '';
  return name.trim().toLowerCase();
}

/**
 * Calculates remaining balance for a single credit transaction
 */
export function getTransactionBalance(tx: SaleTransaction): number {
  if (tx.paymentMethod !== 'utang') return 0;
  if (tx.isAdvanceDeposit) return 0; // Advance deposits are not debts
  if (tx.isCreditSettled) return 0;

  const total = tx.total || 0;
  let paid = tx.amountPaid || 0;

  if (paid === 0 && tx.payments && tx.payments.length > 0) {
    paid = tx.payments.reduce((sum, p) => sum + p.amount, 0);
  }

  return Math.max(0, total - paid);
}

/**
 * Calculates total amount paid on a transaction
 */
export function getTransactionAmountPaid(tx: SaleTransaction): number {
  if (tx.paymentMethod !== 'utang') return tx.total;
  if (tx.isCreditSettled) return tx.total;
  if (typeof tx.amountPaid === 'number' && tx.amountPaid > 0) return tx.amountPaid;
  if (tx.payments && tx.payments.length > 0) {
    return tx.payments.reduce((sum, p) => sum + p.amount, 0);
  }
  return 0;
}

/**
 * Returns summary for a specific customer
 */
export function getCustomerCreditSummary(
  sales: SaleTransaction[],
  rawName: string
): CustomerDebtorSummary {
  const norm = normalizeCustomerName(rawName);
  const customerTxs = sales.filter(
    (s) => s.paymentMethod === 'utang' && normalizeCustomerName(s.customerName) === norm
  );

  let totalDebt = 0;
  let totalPaid = 0;
  let advanceDeposit = 0;
  const unpaidTransactions: SaleTransaction[] = [];
  const paidTransactions: SaleTransaction[] = [];
  const allPayments: CreditPayment[] = [];

  let latestCreditDate: string | undefined;
  let latestPaymentDate: string | undefined;

  customerTxs.forEach((tx) => {
    if (tx.isAdvanceDeposit) {
      const advAmt = tx.total || (tx.payments ? tx.payments.reduce((s, p) => s + p.amount, 0) : 0);
      advanceDeposit += advAmt;
      if (tx.payments) allPayments.push(...tx.payments);
      return;
    }

    totalDebt += tx.total;
    const paid = getTransactionAmountPaid(tx);
    totalPaid += paid;

    if (tx.payments && tx.payments.length > 0) {
      allPayments.push(...tx.payments);
    }

    if (!tx.isCreditSettled && tx.total - paid > 0) {
      unpaidTransactions.push(tx);
    } else {
      paidTransactions.push(tx);
    }

    if (!latestCreditDate || new Date(tx.timestamp) > new Date(latestCreditDate)) {
      latestCreditDate = tx.timestamp;
    }

    if (tx.creditSettledDate) {
      if (!latestPaymentDate || new Date(tx.creditSettledDate) > new Date(latestPaymentDate)) {
        latestPaymentDate = tx.creditSettledDate;
      }
    }
  });

  allPayments.forEach((p) => {
    if (!latestPaymentDate || new Date(p.paymentDate) > new Date(latestPaymentDate)) {
      latestPaymentDate = p.paymentDate;
    }
  });

  // Net balance: debt minus paid minus advance deposits
  const netBalance = Math.max(0, totalDebt - totalPaid - advanceDeposit);
  const remainingAdvance = Math.max(0, advanceDeposit + totalPaid - totalDebt);

  return {
    customerName: customerTxs[0]?.customerName || rawName,
    totalDebt,
    totalPaid,
    netBalance,
    advanceDeposit: remainingAdvance,
    unpaidCount: unpaidTransactions.length,
    latestCreditDate,
    latestPaymentDate,
    unpaidTransactions,
    paidTransactions,
    allTransactions: customerTxs,
    allPayments,
  };
}

/**
 * Extracts list of all unique customers who have utang or credit accounts
 */
export function getAllDebtorsSummary(sales: SaleTransaction[]): CustomerDebtorSummary[] {
  const creditSales = sales.filter((s) => s.paymentMethod === 'utang' && s.customerName?.trim());
  const nameMap = new Map<string, string>(); // norm -> original display name

  creditSales.forEach((s) => {
    const raw = s.customerName!.trim();
    const norm = normalizeCustomerName(raw);
    if (!nameMap.has(norm)) {
      nameMap.set(norm, raw);
    }
  });

  const summaries: CustomerDebtorSummary[] = [];
  nameMap.forEach((rawName) => {
    summaries.push(getCustomerCreditSummary(sales, rawName));
  });

  // Sort: customers with highest unpaid balance first, then newest
  summaries.sort((a, b) => {
    if (b.netBalance !== a.netBalance) return b.netBalance - a.netBalance;
    const aTime = a.latestCreditDate ? new Date(a.latestCreditDate).getTime() : 0;
    const bTime = b.latestCreditDate ? new Date(b.latestCreditDate).getTime() : 0;
    return bTime - aTime;
  });

  return summaries;
}

/**
 * Sequentially applies a payment to a customer's unpaid credit transactions (oldest first).
 * Excess amount is recorded as advance payment credit.
 */
export function applyPaymentToDebts(
  allSales: SaleTransaction[],
  customerName: string,
  paymentAmount: number,
  paymentDate: string = new Date().toISOString(),
  paymentMethod: 'cash' | 'gcash' | 'maya' = 'cash',
  notes?: string
): {
  updatedSales: SaleTransaction[];
  amountApplied: number;
  excessAdvance: number;
} {
  const norm = normalizeCustomerName(customerName);
  let remainingPayment = Math.max(0, paymentAmount);

  // Get unpaid credit transactions for this customer, sorted oldest first
  const customerUnpaid = allSales
    .filter(
      (s) =>
        s.paymentMethod === 'utang' &&
        !s.isCreditSettled &&
        !s.isAdvanceDeposit &&
        normalizeCustomerName(s.customerName) === norm
    )
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const updatedSalesMap = new Map<string, SaleTransaction>();

  customerUnpaid.forEach((tx) => {
    if (remainingPayment <= 0) return;

    const currentBalance = getTransactionBalance(tx);
    if (currentBalance <= 0) return;

    const paymentForThis = Math.min(currentBalance, remainingPayment);
    remainingPayment -= paymentForThis;

    const currentPaid = getTransactionAmountPaid(tx);
    const newAmountPaid = currentPaid + paymentForThis;
    const isNowSettled = newAmountPaid >= tx.total;

    const newPaymentRecord: CreditPayment = {
      id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      amount: paymentForThis,
      paymentDate,
      paymentMethod,
      notes,
    };

    const existingPayments = tx.payments || [];

    const updatedTx: SaleTransaction = {
      ...tx,
      amountPaid: newAmountPaid,
      isCreditSettled: isNowSettled,
      creditSettledDate: isNowSettled ? paymentDate : tx.creditSettledDate,
      payments: [...existingPayments, newPaymentRecord],
    };

    updatedSalesMap.set(updatedTx.id, updatedTx);
  });

  // Rebuild sales array
  let finalSales = allSales.map((s) => updatedSalesMap.get(s.id) || s);

  // If there is excess payment remaining, record it as an Advance Deposit (Paunang Bayad)
  const excessAdvance = remainingPayment;
  if (excessAdvance > 0) {
    const advanceRecord: SaleTransaction = {
      id: `advance-${Date.now()}`,
      receiptNumber: `ADV-${Date.now().toString().slice(-6)}`,
      timestamp: paymentDate,
      items: [
        {
          productId: 'advance-credit',
          productName: 'Paunang Bayad / Advance Deposit',
          barcode: 'ADVANCE',
          quantity: 1,
          unit: 'deposit',
          costPrice: 0,
          unitPrice: excessAdvance,
          subtotal: excessAdvance,
        },
      ],
      subtotal: excessAdvance,
      discount: 0,
      total: excessAdvance,
      cashTendered: excessAdvance,
      change: 0,
      paymentMethod: 'utang',
      customerName,
      isCreditSettled: true,
      creditSettledDate: paymentDate,
      isAdvanceDeposit: true,
      amountPaid: excessAdvance,
      payments: [
        {
          id: `pay-${Date.now()}`,
          amount: excessAdvance,
          paymentDate,
          paymentMethod,
          notes: notes || 'Paunang hulog / advance deposit',
          isAdvance: true,
        },
      ],
      notes: notes ? `Advance: ${notes}` : 'Paunang hulog / advance deposit',
    };

    finalSales = [advanceRecord, ...finalSales];
  }

  return {
    updatedSales: finalSales,
    amountApplied: paymentAmount - excessAdvance,
    excessAdvance,
  };
}
