import React, { useState, useMemo } from 'react';
import { SaleTransaction, PaymentMethod, CreditPayment } from '../types';
import {
  getAllDebtorsSummary,
  getCustomerCreditSummary,
  CustomerDebtorSummary,
  getTransactionBalance,
  getTransactionAmountPaid,
} from '../utils/creditUtils';
import {
  User,
  CheckCircle2,
  Clock,
  Calendar,
  Search,
  DollarSign,
  AlertCircle,
  Plus,
  ArrowRight,
  Receipt,
  CreditCard,
  Banknote,
  Sparkles,
  History,
  X,
  ChevronRight,
  TrendingUp,
  FileText,
  Wallet,
  Users,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { playCheckoutChime, playWarningSound } from '../utils/audio';
import confetti from 'canvas-confetti';

interface UtangLedgerViewProps {
  sales: SaleTransaction[];
  onRecordPayment: (
    customerName: string,
    amount: number,
    paymentDate: string,
    paymentMethod: 'cash' | 'gcash' | 'maya',
    notes?: string
  ) => void;
  onAddDirectCredit: (
    creditData: Omit<SaleTransaction, 'id' | 'receiptNumber'>
  ) => void;
  onLockUtang?: () => void;
}

export const UtangLedgerView: React.FC<UtangLedgerViewProps> = ({
  sales,
  onRecordPayment,
  onAddDirectCredit,
  onLockUtang,
}) => {
  // Navigation & Search State
  const [activeTab, setActiveTab] = useState<'customers' | 'transactions'>('customers');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('unpaid');
  const [search, setSearch] = useState('');

  // Modal States
  const [paymentModalCustomer, setPaymentModalCustomer] = useState<CustomerDebtorSummary | null>(null);
  const [historyModalCustomer, setHistoryModalCustomer] = useState<CustomerDebtorSummary | null>(null);
  const [isNewCreditModalOpen, setIsNewCreditModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Payment Form States
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash' | 'maya'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');

  // New Credit Form States
  const [newCreditName, setNewCreditName] = useState('');
  const [newCreditAmount, setNewCreditAmount] = useState<number | ''>('');
  const [newCreditDate, setNewCreditDate] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [newCreditItems, setNewCreditItems] = useState('');
  const [newCreditNotes, setNewCreditNotes] = useState('');

  // Advance Deposit Form States
  const [advanceName, setAdvanceName] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState<number | ''>('');
  const [advanceDate, setAdvanceDate] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [advanceMethod, setAdvanceMethod] = useState<'cash' | 'gcash' | 'maya'>('cash');
  const [advanceNotes, setAdvanceNotes] = useState('');

  // All debtors summaries
  const debtors = useMemo(() => getAllDebtorsSummary(sales), [sales]);

  // Filtered Debtors list
  const filteredDebtors = useMemo(() => {
    return debtors.filter((d) => {
      const matchesSearch =
        d.customerName.toLowerCase().includes(search.toLowerCase()) ||
        d.allTransactions.some((t) => t.receiptNumber.toLowerCase().includes(search.toLowerCase()));

      if (!matchesSearch) return false;

      if (statusFilter === 'unpaid') return d.netBalance > 0;
      if (statusFilter === 'paid') return d.netBalance === 0;
      return true;
    });
  }, [debtors, search, statusFilter]);

  // Filtered raw transactions
  const creditTransactions = useMemo(() => {
    return sales
      .filter((s) => s.paymentMethod === 'utang')
      .filter((s) => {
        const debtorName = s.customerName?.toLowerCase() || '';
        const receipt = s.receiptNumber.toLowerCase();
        const matchesSearch =
          debtorName.includes(search.toLowerCase()) || receipt.includes(search.toLowerCase());

        if (!matchesSearch) return false;

        const isSettled = s.isCreditSettled || getTransactionBalance(s) <= 0;
        if (statusFilter === 'unpaid') return !isSettled;
        if (statusFilter === 'paid') return isSettled;
        return true;
      });
  }, [sales, search, statusFilter]);

  // Overall Statistics
  const totalUnpaidAmount = debtors.reduce((sum, d) => sum + d.netBalance, 0);
  const totalAdvanceDeposits = debtors.reduce((sum, d) => sum + d.advanceDeposit, 0);
  const totalPaidAmount = debtors.reduce((sum, d) => sum + d.totalPaid, 0);
  const activeDebtorsCount = debtors.filter((d) => d.netBalance > 0).length;

  // Open Payment / Hulog Modal
  const handleOpenPaymentModal = (debtor: CustomerDebtorSummary) => {
    setFormError(null);
    setPaymentModalCustomer(debtor);
    setPaymentAmount(debtor.netBalance > 0 ? debtor.netBalance : '');
    setPaymentDate(new Date().toISOString().slice(0, 16));
    setPaymentMethod('cash');
    setPaymentNotes('');
  };

  // Submit Payment / Hulog
  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!paymentModalCustomer) return;
    const amount = typeof paymentAmount === 'number' ? paymentAmount : parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      setFormError('Pakilagay ang wastong halaga ng ibinayad.');
      return;
    }

    onRecordPayment(
      paymentModalCustomer.customerName,
      amount,
      new Date(paymentDate).toISOString(),
      paymentMethod,
      paymentNotes.trim() || undefined
    );

    playCheckoutChime();
    confetti({ particleCount: 45, spread: 55, origin: { y: 0.7 } });
    setPaymentModalCustomer(null);
  };

  // Submit New Credit
  const handleSubmitNewCredit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!newCreditName.trim()) {
      setFormError('Pakilagay ang pangalan ng umutang.');
      return;
    }
    const amount = typeof newCreditAmount === 'number' ? newCreditAmount : parseFloat(newCreditAmount);
    if (!amount || amount <= 0) {
      setFormError('Pakilagay ang wastong halaga ng inutang.');
      return;
    }

    const itemsDesc = newCreditItems.trim() || 'Listahan ng inutang sa tindahan';
    const itemsList = itemsDesc.split(',').map((it, idx) => ({
      productId: `manual-credit-${idx}`,
      productName: it.trim() || 'Paninda',
      barcode: 'UTANG',
      quantity: 1,
      unit: 'pc',
      costPrice: 0,
      unitPrice: amount / (itemsDesc.split(',').length || 1),
      subtotal: amount / (itemsDesc.split(',').length || 1),
    }));

    onAddDirectCredit({
      timestamp: new Date(newCreditDate).toISOString(),
      items: itemsList,
      subtotal: amount,
      discount: 0,
      total: amount,
      cashTendered: 0,
      change: 0,
      paymentMethod: 'utang',
      customerName: newCreditName.trim(),
      isCreditSettled: false,
      amountPaid: 0,
      payments: [],
      notes: newCreditNotes.trim() || undefined,
    });

    playCheckoutChime();
    setIsNewCreditModalOpen(false);
    setNewCreditName('');
    setNewCreditAmount('');
    setNewCreditItems('');
    setNewCreditNotes('');
  };

  // Submit Advance Payment (Paunang Pondo)
  const handleSubmitAdvanceDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!advanceName.trim()) {
      setFormError('Pakilagay ang pangalan ng nag-advance.');
      return;
    }
    const amount = typeof advanceAmount === 'number' ? advanceAmount : parseFloat(advanceAmount);
    if (!amount || amount <= 0) {
      setFormError('Pakilagay ang wastong halaga ng paunang bayad.');
      return;
    }

    onRecordPayment(
      advanceName.trim(),
      amount,
      new Date(advanceDate).toISOString(),
      advanceMethod,
      advanceNotes.trim() ? `Paunang Pondo: ${advanceNotes.trim()}` : 'Paunang Pondo / Advance Payment'
    );

    playCheckoutChime();
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    setIsAdvanceModalOpen(false);
    setAdvanceName('');
    setAdvanceAmount('');
    setAdvanceNotes('');
  };

  return (
    <div className="space-y-4 sm:space-y-5 pb-16">
      {/* Top Header & Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 shadow-sm">
            <User className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Talaan ng Utang at Pautang
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                Credit Ledger
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Subaybayan ang pautang, hulog, paunang bayad (advance), at petsa ng bawat transaksyon.
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto">
          {onLockUtang && (
            <button
              type="button"
              onClick={onLockUtang}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-750 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 shrink-0"
              title="I-lock ang Talaan ng Utang para kailanganin uli ang Admin PIN"
            >
              <Lock className="w-3.5 h-3.5 text-rose-400" />
              <span>I-lock ang Utang</span>
            </button>
          )}

          {/* Add Direct Credit Button */}
          <button
            type="button"
            onClick={() => {
              setNewCreditDate(new Date().toISOString().slice(0, 16));
              setIsNewCreditModalOpen(true);
            }}
            className="flex-1 sm:flex-none px-3.5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Bagong Utang</span>
          </button>

          {/* Record Advance Payment Button */}
          <button
            type="button"
            onClick={() => {
              setAdvanceDate(new Date().toISOString().slice(0, 16));
              setIsAdvanceModalOpen(true);
            }}
            className="flex-1 sm:flex-none px-3.5 py-2.5 bg-slate-800 hover:bg-slate-750 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
            title="Magtala ng paunang hulog o advance deposit ng customer"
          >
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span>+ Paunang Bayad (Advance)</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Total Outstanding Credit */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 block uppercase">
            Kabuuang Pautang (Singilin)
          </span>
          <div className="text-xl sm:text-2xl font-extrabold text-amber-400 font-mono">
            ₱{totalUnpaidAmount.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500">
            {activeDebtorsCount} suki na may balanse
          </span>
        </div>

        {/* Advance Deposits (Paunang Pondo) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 block uppercase">
            Paunang Pondo (Advance)
          </span>
          <div className="text-xl sm:text-2xl font-extrabold text-teal-400 font-mono">
            ₱{totalAdvanceDeposits.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500">Deposito ng mga customer</span>
        </div>

        {/* Total Payments Collected */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 block uppercase">
            Singil na Natanggap
          </span>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono">
            ₱{totalPaidAmount.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500">Kabuuang nabayaran</span>
        </div>

        {/* Suki Customer Count */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 block uppercase">
            Nakatala sa Ledger
          </span>
          <div className="text-xl sm:text-2xl font-extrabold text-white font-mono">
            {debtors.length}
          </div>
          <span className="text-[10px] text-slate-500">Lahat ng suki account</span>
        </div>
      </div>

      {/* Search & Navigation Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
        {/* Search Input */}
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hanapin ang pangalan ng umutang o resibo..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* View Mode Toggle: Customers vs Receipts */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'customers'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Kada Customer</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'transactions'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Lahat ng Resibo</span>
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('unpaid')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
              statusFilter === 'unpaid'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            May Utang
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('paid')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
              statusFilter === 'paid'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Bayad Na
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
              statusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Lahat
          </button>
        </div>
      </div>

      {/* ====================================================================
       * VIEW 1: BY CUSTOMER (Suki Accounts)
       * ==================================================================== */}
      {activeTab === 'customers' && (
        <div className="space-y-3">
          {filteredDebtors.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-12 text-center space-y-4">
              <Users className="w-10 h-10 text-slate-600 mx-auto" />
              <div>
                <p className="text-sm sm:text-base font-semibold text-white">
                  {search.trim()
                    ? `Walang nahanap na "${search}" sa talaan ng utang.`
                    : 'Walang nahanap na customer sa listahan.'}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  {search.trim()
                    ? `Maaari mong itala agad si "${search}" bilang bagong may utang o magtala ng paunang bayad (advance).`
                    : 'Pindutin ang "+ Bagong Utang" sa itaas o pumili ng Utang sa POS checkout para magtala ng pautang.'}
                </p>
              </div>

              {search.trim() ? (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setNewCreditName(search.trim());
                      setNewCreditAmount('');
                      setNewCreditDate(new Date().toISOString().slice(0, 16));
                      setNewCreditItems('');
                      setNewCreditNotes('');
                      setIsNewCreditModalOpen(true);
                    }}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Magtala ng Utang para kay "{search.trim()}"</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAdvanceName(search.trim());
                      setAdvanceAmount('');
                      setAdvanceDate(new Date().toISOString().slice(0, 16));
                      setAdvanceNotes('');
                      setIsAdvanceModalOpen(true);
                    }}
                    className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>+ Magtala ng Advance para kay "{search.trim()}"</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            filteredDebtors.map((debtor) => {
              const hasDebt = debtor.netBalance > 0;
              const hasAdvance = debtor.advanceDeposit > 0;

              return (
                <div
                  key={debtor.customerName}
                  className={`bg-slate-900 border rounded-2xl p-4 sm:p-5 transition-all shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                    hasDebt
                      ? 'border-amber-500/30 hover:border-amber-500/50'
                      : 'border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* Left: Customer Info & Dates */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-white text-base sm:text-lg">
                        {debtor.customerName}
                      </h3>

                      {hasDebt ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                          <Clock className="w-3 h-3" /> May Balanse: ₱{debtor.netBalance.toFixed(2)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> Walang Utang (Settled)
                        </span>
                      )}

                      {hasAdvance && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-300 bg-teal-500/15 px-2.5 py-0.5 rounded-full border border-teal-500/30">
                          <Wallet className="w-3 h-3" /> Paunang Pondo: ₱{debtor.advanceDeposit.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {/* Dates tracking row */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      {debtor.latestCreditDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-amber-400" />
                          <span>Huling Utang:</span>
                          <strong className="text-slate-200">
                            {new Date(debtor.latestCreditDate).toLocaleDateString('en-PH', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </strong>
                        </span>
                      )}

                      {debtor.latestPaymentDate && (
                        <>
                          <span className="text-slate-600 hidden sm:inline">·</span>
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Huling Bayad:</span>
                            <strong className="text-emerald-300">
                              {new Date(debtor.latestPaymentDate).toLocaleDateString('en-PH', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </strong>
                          </span>
                        </>
                      )}

                      <span className="text-slate-600 hidden sm:inline">·</span>
                      <span className="text-slate-500">
                        {debtor.unpaidCount} resibo na may balanse ({debtor.allTransactions.length} kabuuang transaksyon)
                      </span>
                    </div>

                    {/* Quick unpaid item peek */}
                    {debtor.unpaidTransactions.length > 0 && (
                      <div className="text-xs text-slate-400 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 mt-1 max-w-xl">
                        <span className="text-[10px] text-slate-500 font-bold block uppercase mb-1">
                          Kasalukuyang mga inutang na paninda:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {debtor.unpaidTransactions.flatMap((t) => t.items).slice(0, 5).map((it, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[11px] text-slate-300"
                            >
                              {it.quantity}x {it.productName}
                            </span>
                          ))}
                          {debtor.unpaidTransactions.flatMap((t) => t.items).length > 5 && (
                            <span className="text-[11px] text-slate-500 self-center">
                              +{debtor.unpaidTransactions.flatMap((t) => t.items).length - 5} pa...
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Balances & Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-800 gap-3 shrink-0">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">
                        Singiling Balanse:
                      </span>
                      <span
                        className={`text-2xl font-extrabold font-mono ${
                          hasDebt ? 'text-amber-400' : 'text-slate-400'
                        }`}
                      >
                        ₱{debtor.netBalance.toFixed(2)}
                      </span>
                    </div>

                    {/* Action buttons on Customer Card */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Add to Existing Utang Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setNewCreditName(debtor.customerName);
                          setNewCreditAmount('');
                          setNewCreditDate(new Date().toISOString().slice(0, 16));
                          setNewCreditItems('');
                          setNewCreditNotes('');
                          setIsNewCreditModalOpen(true);
                        }}
                        className="px-2.5 sm:px-3 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
                        title="Magdagdag ng bagong inutang sa customer na ito"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Dagdag Utang</span>
                      </button>

                      {/* Pay / Hulog Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenPaymentModal(debtor)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 ${
                          hasDebt
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-teal-600 hover:bg-teal-500 text-white'
                        }`}
                        title="Magtala ng ibinayad o hulog na may petsa"
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        <span>{hasDebt ? 'Magbayad' : '+ Advance'}</span>
                      </button>

                      {/* Advance Button (if has debt, still allow advance deposit) */}
                      {hasDebt && (
                        <button
                          type="button"
                          onClick={() => {
                            setAdvanceName(debtor.customerName);
                            setAdvanceAmount('');
                            setAdvanceDate(new Date().toISOString().slice(0, 16));
                            setAdvanceNotes('');
                            setIsAdvanceModalOpen(true);
                          }}
                          className="px-2 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors"
                          title="Magtala ng Paunang Pondo o Advance Deposit"
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Advance</span>
                        </button>
                      )}

                      {/* View Statement History Button */}
                      <button
                        type="button"
                        onClick={() => setHistoryModalCustomer(debtor)}
                        className="px-2.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Tingnan ang kumpletong talaan ng utang at mga bayad"
                      >
                        <History className="w-3.5 h-3.5 text-slate-400" />
                        <span className="hidden sm:inline">Kasaysayan</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ====================================================================
       * VIEW 2: BY INDIVIDUAL RECEIPTS (All Credit Entries)
       * ==================================================================== */}
      {activeTab === 'transactions' && (
        <div className="space-y-3">
          {creditTransactions.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-2">
              <Receipt className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">Walang rekord ng resibo sa napiling filter.</p>
            </div>
          ) : (
            creditTransactions.map((sale) => {
              const isSettled = sale.isCreditSettled || getTransactionBalance(sale) <= 0;
              const remaining = getTransactionBalance(sale);
              const paid = getTransactionAmountPaid(sale);
              const debtorSummary = getCustomerCreditSummary(sales, sale.customerName || '');

              return (
                <div
                  key={sale.id}
                  className={`bg-slate-900 border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${
                    isSettled
                      ? 'border-slate-800/80 opacity-75'
                      : 'border-amber-500/30 hover:border-amber-500/50'
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white text-base">
                        {sale.customerName || 'Di-kilalang Suki'}
                      </span>
                      {sale.isAdvanceDeposit ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-300 bg-teal-500/15 px-2 py-0.5 rounded-full border border-teal-500/30">
                          <Wallet className="w-3 h-3" /> Paunang Bayad (Advance)
                        </span>
                      ) : isSettled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> Nabayaran Nang Buo
                        </span>
                      ) : paid > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                          <Clock className="w-3 h-3" /> May Hulog Na (Balanse: ₱{remaining.toFixed(2)})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          <Clock className="w-3 h-3" /> Hindi Pa Bayad
                        </span>
                      )}
                    </div>

                    {/* Date and Receipt metadata */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>Petsa ng Utang:</span>
                        <strong className="text-slate-300">
                          {new Date(sale.timestamp).toLocaleDateString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </strong>
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="font-mono text-slate-500">{sale.receiptNumber}</span>
                    </div>

                    {/* Items List */}
                    <div className="text-xs text-slate-400 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 mt-2 space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase">
                        <span>Mga Kinuha:</span>
                        <span>Halaga</span>
                      </div>
                      <div className="space-y-0.5">
                        {sale.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between text-[11px]">
                            <span>
                              {it.quantity}x {it.productName}
                            </span>
                            <span className="font-mono text-slate-300">₱{it.subtotal.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      {sale.notes && (
                        <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-800">
                          Tala: {sale.notes}
                        </p>
                      )}
                    </div>

                    {/* Payments History on this transaction */}
                    {sale.payments && sale.payments.length > 0 && (
                      <div className="text-[11px] text-slate-400 bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-2.5 space-y-1">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase block">
                          Talaan ng mga Ibinayad (Hulog):
                        </span>
                        {sale.payments.map((p, idx) => (
                          <div key={idx} className="flex justify-between items-center text-slate-300">
                            <span>
                              {new Date(p.paymentDate).toLocaleDateString('en-PH', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              ({p.paymentMethod.toUpperCase()}) {p.notes ? `• ${p.notes}` : ''}
                            </span>
                            <span className="font-mono font-bold text-emerald-400">
                              +₱{p.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Amounts & Action */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800 gap-3 shrink-0">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">
                        {isSettled ? 'Kabuuang Nabayaran:' : 'Natitirang Utang:'}
                      </span>
                      <span
                        className={`text-xl font-extrabold font-mono ${
                          isSettled ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        ₱{(isSettled ? sale.total : remaining).toFixed(2)}
                      </span>
                      {!isSettled && paid > 0 && (
                        <span className="text-[10px] text-slate-500 block">
                          (Naibayad na: ₱{paid.toFixed(2)} ng ₱{sale.total.toFixed(2)})
                        </span>
                      )}
                    </div>

                    {!isSettled && (
                      <button
                        type="button"
                        onClick={() => handleOpenPaymentModal(debtorSummary)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        <Banknote className="w-4 h-4" />
                        <span>Magbayad</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ====================================================================
       * MODAL 1: RECORD PAYMENT / HULOG (With Date & Advance Detection)
       * ==================================================================== */}
      {paymentModalCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Pagtanggap ng Bayad / Hulog</h3>
                  <p className="text-xs text-slate-400">Para kay: {paymentModalCustomer.customerName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalCustomer(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-5 space-y-4 overflow-y-auto">
              {/* Balance Summary Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex justify-between items-center">
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-bold block">
                    Kasalukuyang Utang:
                  </span>
                  <span className="text-2xl font-extrabold text-amber-400 font-mono">
                    ₱{paymentModalCustomer.netBalance.toFixed(2)}
                  </span>
                </div>
                {paymentModalCustomer.advanceDeposit > 0 && (
                  <div className="text-right">
                    <span className="text-[11px] text-teal-400 uppercase font-bold block">
                      May Paunang Pondo:
                    </span>
                    <span className="text-lg font-bold text-teal-300 font-mono">
                      ₱{paymentModalCustomer.advanceDeposit.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Payment Date & Time Input (CRITICAL USER REQUEST) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Petsa ng Pagbabayad (Date of Payment):</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Amount to Pay */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">
                  Halagang Ibinabayad (Amount):
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold font-mono">
                    ₱
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    autoFocus
                    required
                    value={paymentAmount}
                    onChange={(e) =>
                      setPaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-4 py-2.5 text-base font-bold text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Quick Shortcut Buttons */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {paymentModalCustomer.netBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(paymentModalCustomer.netBalance)}
                      className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30"
                    >
                      Bayad Buo (₱{paymentModalCustomer.netBalance.toFixed(0)})
                    </button>
                  )}
                  {[50, 100, 200, 500, 1000].map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setPaymentAmount(b)}
                      className="px-2 py-1 text-xs font-mono rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      ₱{b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Status Calculation Preview */}
              {typeof paymentAmount === 'number' && paymentAmount > 0 && (
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Resulta ng Bayad:</span>
                    <span className="font-bold">
                      {paymentAmount < paymentModalCustomer.netBalance ? (
                        <span className="text-amber-400 font-semibold">
                          Hulog (May matitirang ₱{(paymentModalCustomer.netBalance - paymentAmount).toFixed(2)})
                        </span>
                      ) : paymentAmount === paymentModalCustomer.netBalance ? (
                        <span className="text-emerald-400 font-bold">
                          ✓ Bayad Nang Buo (₱0.00 Balanse)
                        </span>
                      ) : (
                        <span className="text-teal-400 font-bold">
                          ✓ Bayad Buo + ₱{(paymentAmount - paymentModalCustomer.netBalance).toFixed(2)} Advance Pondo!
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Payment Method Selector */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Paraan ng Bayad:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" /> Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('gcash')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 ${
                      paymentMethod === 'gcash'
                        ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" /> GCash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('maya')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 ${
                      paymentMethod === 'maya'
                        ? 'bg-teal-600/20 border-teal-500 text-teal-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Maya
                  </button>
                </div>
              </div>

              {/* Payment Notes */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Tala (Opsyonal):</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Hal. Hulog galing sa sahod / Barya"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              {formError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold">
                  {formError}
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalCustomer(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Kanselahin
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                >
                  Kumpirmahin ang Bayad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
       * MODAL 2: ADD DIRECT CREDIT (+ Bagong Utang na may Petsa)
       * ==================================================================== */}
      {isNewCreditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Magtala ng Bagong Utang</h3>
                  <p className="text-xs text-slate-400">Itala ang paninda at petsa ng pagkautang</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCreditModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewCredit} className="p-5 space-y-4 overflow-y-auto">
              {/* Customer Name with Autocomplete of Existing Debtors */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">
                  Pangalan ng Umutang (Customer Name) <span className="text-rose-400">*</span>:
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newCreditName}
                  onChange={(e) => setNewCreditName(e.target.value)}
                  placeholder="Hal. Ate Rosa / Pareng Boyet"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                />

                {/* Autocomplete Suggestions from Existing Debtors */}
                {newCreditName.trim() && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {debtors
                      .filter((d) =>
                        d.customerName.toLowerCase().includes(newCreditName.toLowerCase())
                      )
                      .slice(0, 4)
                      .map((d) => (
                        <button
                          key={d.customerName}
                          type="button"
                          onClick={() => setNewCreditName(d.customerName)}
                          className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500 text-[11px] text-slate-300 flex items-center gap-1"
                        >
                          <span>{d.customerName}</span>
                          <span className="font-mono text-amber-400">
                            (May utang: ₱{d.netBalance.toFixed(0)})
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Date of Utang (CRITICAL USER REQUEST) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>Petsa ng Pagkautang (Date Incurred):</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newCreditDate}
                  onChange={(e) => setNewCreditDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Total Amount of Utang */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">
                  Halaga ng Utang (₱ Total Amount) <span className="text-rose-400">*</span>:
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">
                    ₱
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={newCreditAmount}
                    onChange={(e) =>
                      setNewCreditAmount(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-4 py-2.5 text-base font-bold text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Existing Debt + Added Credit Breakdown */}
                {(() => {
                  const matchedDebtor = debtors.find(
                    (d) => d.customerName.toLowerCase() === newCreditName.trim().toLowerCase()
                  );
                  if (!matchedDebtor) return null;
                  const addedAmount =
                    typeof newCreditAmount === 'number'
                      ? newCreditAmount
                      : parseFloat(newCreditAmount) || 0;
                  const newTotalBalance = matchedDebtor.netBalance + addedAmount;

                  return (
                    <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-300">
                        <span>Dating Utang ni {matchedDebtor.customerName}:</span>
                        <span className="font-mono font-bold text-amber-400">
                          ₱{matchedDebtor.netBalance.toFixed(2)}
                        </span>
                      </div>
                      {matchedDebtor.advanceDeposit > 0 && (
                        <div className="flex justify-between text-teal-300 font-semibold">
                          <span>May Paunang Pondo (Advance):</span>
                          <span className="font-mono text-teal-400">
                            -₱{matchedDebtor.advanceDeposit.toFixed(2)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-300">
                        <span>Idaragdag na Bagong Utang:</span>
                        <span className="font-mono font-bold text-emerald-400">
                          +₱{addedAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="pt-1.5 border-t border-slate-800 flex justify-between font-bold text-white">
                        <span>Magiging Kabuuang Utang:</span>
                        <span className="font-mono text-amber-400 text-sm">
                          ₱{Math.max(0, newTotalBalance - matchedDebtor.advanceDeposit).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Items inutang */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Mga Panindang Inutang (Items):
                </label>
                <input
                  type="text"
                  value={newCreditItems}
                  onChange={(e) => setNewCreditItems(e.target.value)}
                  placeholder="Hal. 2 sardinas, 1 kilong bigas, mantika..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Tala (Opsyonal):</label>
                <input
                  type="text"
                  value={newCreditNotes}
                  onChange={(e) => setNewCreditNotes(e.target.value)}
                  placeholder="Hal. Babayaran sa kinsenas / Biyernes"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                />
              </div>

              {formError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold">
                  {formError}
                </div>
              )}

              {/* Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewCreditModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Kanselahin
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                >
                  Itala ang Utang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
       * MODAL 3: RECORD ADVANCE PAYMENT (Paunang Bayad / Pondo)
       * ==================================================================== */}
      {isAdvanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Magtala ng Paunang Bayad (Advance)</h3>
                  <p className="text-xs text-slate-400">Pondong magagamit ng customer sa susunod na bili</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdvanceModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdvanceDeposit} className="p-5 space-y-4 overflow-y-auto">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Pangalan ng Customer:</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={advanceName}
                  onChange={(e) => setAdvanceName(e.target.value)}
                  placeholder="Hal. Ate Marites"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-500"
                />

                {/* Autocomplete Suggestions from Existing Debtors */}
                {advanceName.trim() && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {debtors
                      .filter((d) =>
                        d.customerName.toLowerCase().includes(advanceName.toLowerCase())
                      )
                      .slice(0, 4)
                      .map((d) => (
                        <button
                          key={d.customerName}
                          type="button"
                          onClick={() => setAdvanceName(d.customerName)}
                          className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-teal-500 text-[11px] text-slate-300 flex items-center gap-1"
                        >
                          <span>{d.customerName}</span>
                          <span className="font-mono text-teal-400">
                            {d.netBalance > 0
                              ? `(May utang: ₱${d.netBalance.toFixed(0)})`
                              : `(Pondo: ₱${d.advanceDeposit.toFixed(0)})`}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-400" />
                  <span>Petsa ng Advance Deposit:</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={advanceDate}
                  onChange={(e) => setAdvanceDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Halaga ng Paunang Bayad (₱):</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={advanceAmount}
                  onChange={(e) =>
                    setAdvanceAmount(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-base font-bold text-white font-mono focus:outline-none focus:border-teal-500"
                />

                {/* Advance Offset Calculation Preview */}
                {(() => {
                  const matchedDebtor = debtors.find(
                    (d) => d.customerName.toLowerCase() === advanceName.trim().toLowerCase()
                  );
                  const advAmt =
                    typeof advanceAmount === 'number'
                      ? advanceAmount
                      : parseFloat(advanceAmount) || 0;
                  if (!advAmt || advAmt <= 0) return null;

                  if (matchedDebtor && matchedDebtor.netBalance > 0) {
                    const remainingDebt = Math.max(0, matchedDebtor.netBalance - advAmt);
                    const excessAdvance = Math.max(0, advAmt - matchedDebtor.netBalance);

                    return (
                      <div className="bg-slate-950 border border-teal-500/30 rounded-xl p-3 space-y-1 text-xs mt-1.5">
                        <div className="flex justify-between text-slate-300">
                          <span>Kasalukuyang Utang ni {matchedDebtor.customerName}:</span>
                          <span className="font-mono text-amber-400 font-bold">
                            ₱{matchedDebtor.netBalance.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-teal-300 font-semibold">
                          <span>Ibabawas mula sa Paunang Bayad:</span>
                          <span className="font-mono">
                            -₱{Math.min(advAmt, matchedDebtor.netBalance).toFixed(2)}
                          </span>
                        </div>
                        {remainingDebt > 0 ? (
                          <div className="pt-1 border-t border-slate-800 flex justify-between font-bold text-amber-400">
                            <span>Matitirang Utang:</span>
                            <span className="font-mono">₱{remainingDebt.toFixed(2)}</span>
                          </div>
                        ) : (
                          <div className="pt-1 border-t border-slate-800 flex justify-between font-bold text-emerald-400">
                            <span>Utang: Bayad Buo! May Sobrang Pondo:</span>
                            <span className="font-mono text-teal-400">₱{excessAdvance.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div className="bg-slate-950 border border-teal-500/30 rounded-xl p-2.5 text-xs text-teal-300 mt-1.5 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      <span>
                        Itatala bilang <strong>₱{advAmt.toFixed(2)} Paunang Pondo</strong> na awtomatikong
                        ibabawas sa mga kukunin paninda.
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Tala (Opsyonal):</label>
                <input
                  type="text"
                  value={advanceNotes}
                  onChange={(e) => setAdvanceNotes(e.target.value)}
                  placeholder="Hal. Paunang pambili ng bigas bukas"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                />
              </div>

              {formError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold">
                  {formError}
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdvanceModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Kanselahin
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shadow-md"
                >
                  Itala ang Advance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
       * MODAL 4: COMPLETE CUSTOMER STATEMENT & HISTORY MODAL
       * ==================================================================== */}
      {historyModalCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Kasaysayan ng Utang at Bayad
                  </h3>
                  <p className="text-xs text-slate-400">Suki: {historyModalCustomer.customerName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalCustomer(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Balance Summary Header */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Kabuuang Utang:</span>
                  <span className="text-base font-bold text-slate-200 font-mono">
                    ₱{historyModalCustomer.totalDebt.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Naibayad Na:</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">
                    ₱{historyModalCustomer.totalPaid.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Kasalukuyang Balanse:</span>
                  <span className="text-base font-extrabold text-amber-400 font-mono">
                    ₱{historyModalCustomer.netBalance.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Transactions Breakdown */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase">
                  Mga Resibo at Transaksyon:
                </h4>
                <div className="space-y-2">
                  {historyModalCustomer.allTransactions.map((tx) => {
                    const isSettled = tx.isCreditSettled || getTransactionBalance(tx) <= 0;
                    return (
                      <div
                        key={tx.id}
                        className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono text-slate-400 text-[11px] block">
                              {tx.receiptNumber}
                            </span>
                            <span className="text-slate-300 flex items-center gap-1 text-[11px]">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              {new Date(tx.timestamp).toLocaleDateString('en-PH', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-white font-mono block">
                              ₱{tx.total.toFixed(2)}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                isSettled
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {isSettled ? 'Bayad Na' : 'May Balanse'}
                            </span>
                          </div>
                        </div>

                        {/* Items */}
                        <div className="text-[11px] text-slate-400 bg-slate-900/60 p-1.5 rounded-lg">
                          {tx.items.map((i, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span>{i.quantity}x {i.productName}</span>
                              <span className="font-mono">₱{i.subtotal.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Payment log on this tx */}
                        {tx.payments && tx.payments.length > 0 && (
                          <div className="text-[10px] text-emerald-400 space-y-0.5 pt-1 border-t border-slate-800">
                            {tx.payments.map((p, pIdx) => (
                              <div key={pIdx} className="flex justify-between">
                                <span>
                                  Hulog noong{' '}
                                  {new Date(p.paymentDate).toLocaleDateString('en-PH', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                <span className="font-mono font-bold">+₱{p.amount.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Button */}
              {historyModalCustomer.netBalance > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const cust = historyModalCustomer;
                    setHistoryModalCustomer(null);
                    handleOpenPaymentModal(cust);
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Banknote className="w-4 h-4" />
                  <span>Magbayad / Maghulog para kay {historyModalCustomer.customerName}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
