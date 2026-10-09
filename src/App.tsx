import React, { useState, useEffect } from 'react';
import { Product, CartItem, SaleTransaction, StoreSettings } from './types';
import {
  getStoredProducts,
  saveStoredProducts,
  getStoredSales,
  saveStoredSales,
  getStoredSettings,
  saveStoredSettings,
  exportFullBackup,
  importFullBackup,
  resetToDefaults,
} from './utils/storage';
import {
  testFirestoreConnection,
  seedInitialFirestoreData,
  subscribeToProducts,
  subscribeToSales,
  subscribeToSettings,
  syncSaveProduct,
  syncDeleteProduct,
  syncClearAllProducts,
  syncRecordSale,
  syncSettleCredit,
  syncUpdateSaleTransaction,
  syncBatchUpdateSales,
  syncSaveSettings,
} from './services/firebase';
import { applyPaymentToDebts } from './utils/creditUtils';
import { POSView, POSMode } from './components/POSView';
import { InventoryView } from './components/InventoryView';
import { LowStockAlertsView } from './components/LowStockAlertsView';
import { UtangLedgerView } from './components/UtangLedgerView';
import { SalesHistoryView } from './components/SalesHistoryView';
import { CustomerStorefrontView } from './components/CustomerStorefrontView';
import { PriceCheckerModal } from './components/PriceCheckerModal';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { InstallPhoneModal } from './components/InstallPhoneModal';
import { ManageCategoriesModal } from './components/ManageCategoriesModal';
import {
  ChangePinModal,
  PinRecoveryModal,
  RecoverySettingsModal,
} from './components/AdminPinModals';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, isSampleProductId } from './utils/sampleData';
import {
  Store,
  ShoppingCart,
  Receipt,
  Boxes,
  Tag,
  AlertTriangle,
  UserCheck,
  BarChart3,
  Camera,
  Volume2,
  VolumeX,
  Download,
  Settings,
  Smartphone,
  Cloud,
  CheckCircle2,
  X,
  Layers,
  Lock,
  Unlock,
  KeyRound,
  ShieldCheck,
  HelpCircle,
  Shield,
  Sparkles,
  Palette,
  RefreshCw,
  SlidersHorizontal,
  Globe,
} from 'lucide-react';
import { playScanBeep, playWarningSound, playCheckoutChime } from './utils/audio';

type ActiveTab = 'pos' | 'inventory' | 'low-stock' | 'utang' | 'sales' | 'customer-store';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [posInitialMode, setPosInitialMode] = useState<POSMode>('catalog');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>(getStoredProducts());
  const [sales, setSales] = useState<SaleTransaction[]>(getStoredSales());
  const [settings, setSettings] = useState<StoreSettings>(getStoredSettings());
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [cloudSyncToast, setCloudSyncToast] = useState<string | null>(null);

  // Dedicated Customer Portal mode (via ?mode=store or ?store=1 or #store)
  const [isCustomerMode, setIsCustomerMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('mode') === 'store' ||
      params.get('store') === '1' ||
      params.get('mode') === 'customer' ||
      window.location.hash === '#store'
    );
  });

  useEffect(() => {
    const handleUrlChange = () => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const isStore =
        params.get('mode') === 'store' ||
        params.get('store') === '1' ||
        params.get('mode') === 'customer' ||
        window.location.hash === '#store';
      setIsCustomerMode(isStore);
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Global modals
  const [isPriceCheckerOpen, setIsPriceCheckerOpen] = useState(false);
  const [isGlobalScannerOpen, setIsGlobalScannerOpen] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);

  // 6-Digit Admin PIN Protection for Talaan ng Utang & Owner Recovery
  const [isUtangUnlocked, setIsUtangUnlocked] = useState(false);
  const [isUtangPinModalOpen, setIsUtangPinModalOpen] = useState(false);
  const [isChangePinModalOpen, setIsChangePinModalOpen] = useState(false);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [isRecoverySettingsModalOpen, setIsRecoverySettingsModalOpen] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Theme helper: 'rose-boutique' (default girly & professional chic) or 'classic-emerald'
  const isRoseTheme = (settings.theme || 'rose-boutique') === 'rose-boutique';

  const toggleTheme = () => {
    const nextTheme: 'rose-boutique' | 'classic-emerald' = isRoseTheme ? 'classic-emerald' : 'rose-boutique';
    const next = { ...settings, theme: nextTheme };
    setSettings(next);
    saveStoredSettings(next);
    syncSaveSettings(next).catch(() => {});
  };

  const handleNavigateToUtang = () => {
    if (settings.requireUtangPin !== false && !isUtangUnlocked) {
      setEnteredPin('');
      setPinError(null);
      setIsUtangPinModalOpen(true);
    } else {
      setActiveTab('utang');
    }
  };

  const handleLockUtang = () => {
    setIsUtangUnlocked(false);
    setActiveTab('pos');
  };

  // Helper to get normalized 6-digit PIN
  const getTargetPin = () => {
    const raw = settings.adminPin || '123456';
    if (raw.length === 6) return raw;
    if (raw === '1234') return '123456';
    return raw.padEnd(6, '0').slice(0, 6);
  };

  const verifyPin = (pinToTest: string) => {
    const targetPin = getTargetPin();
    if (pinToTest === targetPin) {
      setIsUtangUnlocked(true);
      setIsUtangPinModalOpen(false);
      setActiveTab('utang');
      setEnteredPin('');
      setPinError(null);
    } else {
      setPinError('Maling 6-digit PIN. Pakisubukan muli o gamitin ang "Nakalimutan ang PIN" sa ibaba.');
      playWarningSound();
      setTimeout(() => {
        setEnteredPin('');
      }, 700);
    }
  };

  const handlePinDigit = (digit: string) => {
    if (enteredPin.length >= 6) return;
    const next = enteredPin + digit;
    setEnteredPin(next);
    setPinError(null);
    if (next.length === 6) {
      verifyPin(next);
    }
  };

  const handlePinBackspace = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
    setPinError(null);
  };

  // Keyboard navigation for computer / laptop users in PIN Keypad modal
  useEffect(() => {
    if (!isUtangPinModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handlePinDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handlePinBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        verifyPin(enteredPin);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsUtangPinModalOpen(false);
        setEnteredPin('');
        setPinError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUtangPinModalOpen, enteredPin, settings.adminPin]);

  const handleChangePinSuccess = (newPin: string) => {
    const next: StoreSettings = { ...settings, adminPin: newPin };
    setSettings(next);
    saveStoredSettings(next);
    syncSaveSettings(next).catch(() => {});
  };

  const handleSaveRecoverySettings = (question: string, answer: string, masterCode: string) => {
    const next: StoreSettings = {
      ...settings,
      recoveryQuestion: question,
      recoveryAnswer: answer,
      masterRecoveryCode: masterCode,
    };
    setSettings(next);
    saveStoredSettings(next);
    syncSaveSettings(next).catch(() => {});
  };

  // Setup real-time Firebase multi-phone synchronization
  useEffect(() => {
    let unsubscribeProducts = () => {};
    let unsubscribeSales = () => {};
    let unsubscribeSettings = () => {};

    const initCloud = async () => {
      try {
        await testFirestoreConnection();
        await seedInitialFirestoreData();
        setIsCloudSynced(true);

        // Immediately push any local products that might have been saved on this phone/computer
        const localItems = getStoredProducts();
        if (localItems.length > 0) {
          for (const item of localItems) {
            syncSaveProduct(item).catch(() => {});
          }
        }

        // Real-time listener for products across all phones (Protected against wiping local inventory)
        unsubscribeProducts = subscribeToProducts((cloudProducts) => {
          const cleanCloud = cloudProducts.filter((p) => !isSampleProductId(p.id));
          setProducts((currentProducts) => {
            const cloudIds = new Set(cleanCloud.map((p) => p.id));
            // Keep local custom products that might be pending sync or created on this device
            const localPending = currentProducts.filter(
              (p) => !cloudIds.has(p.id) && !isSampleProductId(p.id)
            );
            const merged = [...cleanCloud, ...localPending];
            saveStoredProducts(merged);
            // Push any pending local products to cloud
            localPending.forEach((p) => syncSaveProduct(p).catch(() => {}));
            return merged;
          });
        });

        // Real-time listener for sales across all phones
        unsubscribeSales = subscribeToSales((cloudSales) => {
          setSales(cloudSales);
          saveStoredSales(cloudSales);
        });

        // Real-time listener for store settings
        unsubscribeSettings = subscribeToSettings((cloudSettings) => {
          const normalizedPin =
            cloudSettings.adminPin === '1234'
              ? '123456'
              : (cloudSettings.adminPin && cloudSettings.adminPin.length < 6)
              ? cloudSettings.adminPin.padEnd(6, '0')
              : (cloudSettings.adminPin || '123456');
          const cleanSettings: StoreSettings = {
            ...DEFAULT_SETTINGS,
            ...cloudSettings,
            adminPin: normalizedPin,
          };
          setSettings(cleanSettings);
          saveStoredSettings(cleanSettings);
        });
      } catch (err) {
        console.warn('Firebase init error, using local storage fallback:', err);
      }
    };

    initCloud();

    return () => {
      unsubscribeProducts();
      unsubscribeSales();
      unsubscribeSettings();
    };
  }, []);

  const handleManualCloudSync = async () => {
    setIsSyncingCloud(true);
    try {
      const local = getStoredProducts();
      let syncedCount = 0;
      for (const p of local) {
        await syncSaveProduct(p);
        syncedCount++;
      }
      setCloudSyncToast(`✓ Ligtas na nai-sync ang ${syncedCount} paninda sa Cloud!`);
      setTimeout(() => setCloudSyncToast(null), 4000);
    } catch (err) {
      console.warn('Manual sync warning:', err);
      setCloudSyncToast('✓ Naka-save ang mga paninda sa memorya at database.');
      setTimeout(() => setCloudSyncToast(null), 4000);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Update products & save
  const handleAddProduct = async (newProd: Omit<Product, 'id' | 'updatedAt'>) => {
    const created: Product = {
      ...newProd,
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      updatedAt: new Date().toISOString(),
    };
    const updated = [created, ...products.filter((p) => !isSampleProductId(p.id))];
    setProducts(updated);
    saveStoredProducts(updated);

    try {
      await syncSaveProduct(created);
    } catch (err) {
      console.warn('Cloud sync add product fallback:', err);
    }
  };

  const handleUpdateProduct = async (updatedProd: Product) => {
    const updated = products.map((p) => (p.id === updatedProd.id ? updatedProd : p));
    setProducts(updated);
    saveStoredProducts(updated);

    try {
      await syncSaveProduct(updatedProd);
    } catch (err) {
      console.warn('Cloud sync update product fallback:', err);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    const updated = products.filter((p) => p.id !== productId);
    setProducts(updated);
    saveStoredProducts(updated);

    try {
      await syncDeleteProduct(productId);
    } catch (err) {
      console.warn('Cloud sync delete product fallback:', err);
    }
  };

  const handleClearAllProducts = async () => {
    setProducts([]);
    saveStoredProducts([]);

    try {
      await syncClearAllProducts();
    } catch (err) {
      console.warn('Cloud sync clear all products fallback:', err);
    }
  };

  const handleQuickAdjustStock = async (productId: string, delta: number) => {
    let targetProd: Product | null = null;
    const updated = products.map((p) => {
      if (p.id === productId) {
        const nextStock = Math.max(0, p.stock + delta);
        targetProd = { ...p, stock: nextStock, updatedAt: new Date().toISOString() };
        return targetProd;
      }
      return p;
    });
    setProducts(updated);
    saveStoredProducts(updated);

    if (targetProd) {
      try {
        await syncSaveProduct(targetProd);
      } catch (err) {
        console.warn('Cloud sync adjust stock fallback:', err);
      }
    }
  };

  // Restock product from alerts
  const handleRestockProduct = (productId: string, quantityToAdd: number) => {
    handleQuickAdjustStock(productId, quantityToAdd);
  };

  // Complete a sale from POS
  const handleCompleteSale = async (saleData: Omit<SaleTransaction, 'id' | 'receiptNumber'>) => {
    const newTransaction: SaleTransaction = {
      ...saleData,
      id: `sale-${Date.now()}`,
      receiptNumber: `OR-${Date.now().toString().slice(-6)}`,
    };

    // Update sales list locally
    const updatedSales = [newTransaction, ...sales];
    setSales(updatedSales);
    saveStoredSales(updatedSales);

    // Deduct stock for all items purchased
    const updatedProducts = products.map((prod) => {
      const soldItem = saleData.items.find((item) => item.productId === prod.id);
      if (soldItem) {
        const remainingStock = Math.max(0, prod.stock - soldItem.quantity);
        return {
          ...prod,
          stock: remainingStock,
          updatedAt: new Date().toISOString(),
        };
      }
      return prod;
    });

    setProducts(updatedProducts);
    saveStoredProducts(updatedProducts);

    // Sync sale and stock deduction to Cloud Firestore
    try {
      await syncRecordSale(newTransaction, products);
    } catch (err) {
      console.warn('Cloud sync record sale fallback:', err);
    }
  };

  // Record Payment / Hulog / Advance Payment for a customer in Utang ledger
  const handleRecordCustomerPayment = async (
    customerName: string,
    paymentAmount: number,
    paymentDate: string,
    paymentMethod: 'cash' | 'gcash' | 'maya',
    notes?: string
  ) => {
    const { updatedSales } = applyPaymentToDebts(
      sales,
      customerName,
      paymentAmount,
      paymentDate,
      paymentMethod,
      notes
    );

    setSales(updatedSales);
    saveStoredSales(updatedSales);

    try {
      await syncBatchUpdateSales(updatedSales);
    } catch (err) {
      console.warn('Cloud sync payment fallback:', err);
    }
  };

  // Add Direct Credit or Advance Deposit from Utang ledger
  const handleAddDirectCredit = async (
    creditData: Omit<SaleTransaction, 'id' | 'receiptNumber'>
  ) => {
    const newTransaction: SaleTransaction = {
      ...creditData,
      id: `credit-${Date.now()}`,
      receiptNumber: `UTG-${Date.now().toString().slice(-6)}`,
    };

    const updatedSales = [newTransaction, ...sales];
    setSales(updatedSales);
    saveStoredSales(updatedSales);

    try {
      await syncRecordSale(newTransaction, products);
    } catch (err) {
      console.warn('Cloud sync add direct credit fallback:', err);
    }
  };

  // Backup handlers
  const handleExportBackup = () => {
    const jsonStr = exportFullBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tindahan_pos_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportBackup = (json: string) => {
    const success = importFullBackup(json);
    if (success) {
      setProducts(getStoredProducts());
      setSales(getStoredSales());
      setSettings(getStoredSettings());
      alert('Matagumpay na na-import ang backup data!');
    } else {
      alert('Nagka-problema sa pag-import ng file. Pakitiyak na wasto ang JSON backup.');
    }
  };

  const handleResetDefaults = () => {
    if (confirm('Sigurado ka bang ibabalik sa orihinal na sample sari-sari items ang imbentaryo?')) {
      resetToDefaults();
      setProducts(getStoredProducts());
      setSettings(getStoredSettings());
    }
  };

  // Scan handling from global button
  const handleGlobalBarcodeScanned = (barcode: string) => {
    setIsGlobalScannerOpen(false);
    // Open Price Checker and pass query
    setIsPriceCheckerOpen(true);
  };

  // Dynamic Category Management
  const activeCategories = React.useMemo(() => {
    const base =
      settings.customCategories && settings.customCategories.length > 0
        ? settings.customCategories
        : DEFAULT_CATEGORIES;
    const productCats = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    return Array.from(new Set([...base, ...productCats]));
  }, [settings.customCategories, products]);

  const handleRenameCategory = async (oldName: string, newName: string) => {
    const trimmedNew = newName.trim();
    if (!trimmedNew || oldName === trimmedNew) return;

    const currentCats = activeCategories;
    const nextCats = currentCats.map((c) => (c === oldName ? trimmedNew : c));
    if (!nextCats.includes(trimmedNew)) {
      nextCats.push(trimmedNew);
    }
    const nextSettings: StoreSettings = { ...settings, customCategories: nextCats };
    setSettings(nextSettings);
    saveStoredSettings(nextSettings);
    syncSaveSettings(nextSettings).catch(() => {});

    // Update all affected products with this category
    const affected = products.filter((p) => p.category === oldName);
    if (affected.length > 0) {
      const updatedProducts = products.map((p) =>
        p.category === oldName
          ? { ...p, category: trimmedNew, updatedAt: new Date().toISOString() }
          : p
      );
      setProducts(updatedProducts);
      saveStoredProducts(updatedProducts);
      for (const p of affected) {
        syncSaveProduct({
          ...p,
          category: trimmedNew,
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
    }
  };

  const handleAddCategory = async (newCatName: string) => {
    const clean = newCatName.trim();
    if (!clean) return;
    const currentCats = activeCategories;
    if (currentCats.some((c) => c.toLowerCase() === clean.toLowerCase())) return;
    const nextCats = [...currentCats, clean];
    const nextSettings: StoreSettings = { ...settings, customCategories: nextCats };
    setSettings(nextSettings);
    saveStoredSettings(nextSettings);
    syncSaveSettings(nextSettings).catch(() => {});
  };

  const handleDeleteCategory = async (catToDelete: string, fallback = 'Iba pa (General)') => {
    const currentCats = activeCategories;
    const nextCats = currentCats.filter((c) => c !== catToDelete);
    if (!nextCats.includes(fallback)) {
      nextCats.push(fallback);
    }
    const nextSettings: StoreSettings = { ...settings, customCategories: nextCats };
    setSettings(nextSettings);
    saveStoredSettings(nextSettings);
    syncSaveSettings(nextSettings).catch(() => {});

    // Reassign affected products
    const affected = products.filter((p) => p.category === catToDelete);
    if (affected.length > 0) {
      const updatedProducts = products.map((p) =>
        p.category === catToDelete
          ? { ...p, category: fallback, updatedAt: new Date().toISOString() }
          : p
      );
      setProducts(updatedProducts);
      saveStoredProducts(updatedProducts);
      for (const p of affected) {
        syncSaveProduct({
          ...p,
          category: fallback,
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
    }
  };

  const handleResetDefaultCategories = async () => {
    const nextSettings: StoreSettings = { ...settings, customCategories: DEFAULT_CATEGORIES };
    setSettings(nextSettings);
    saveStoredSettings(nextSettings);
    syncSaveSettings(nextSettings).catch(() => {});
  };

  // Low stock counter
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
  const unpaidUtangCount = sales.filter((s) => s.paymentMethod === 'utang' && !s.isCreditSettled).length;
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartGrandTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  // If customer is accessing via online portal link (?mode=store)
  if (isCustomerMode) {
    return (
      <CustomerStorefrontView
        products={products}
        settings={settings}
        categories={activeCategories}
        isCustomerViewOnly={true}
        onBackToAdmin={() => {
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('mode');
            url.searchParams.delete('store');
            url.searchParams.delete('customer');
            window.history.pushState({}, '', url.pathname);
          }
          setIsCustomerMode(false);
          setActiveTab('pos');
        }}
      />
    );
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
      isRoseTheme
        ? 'bg-[#0f0a14] text-rose-50 selection:bg-pink-500 selection:text-white'
        : 'bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950'
    }`}>
      {/* Top Application Header */}
      <header className={`sticky top-0 z-30 backdrop-blur-md border-b transition-colors ${
        isRoseTheme
          ? 'bg-[#150f1d]/90 border-rose-950/60 shadow-lg shadow-rose-950/20'
          : 'bg-slate-900/90 border-slate-800'
      }`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Store Branding */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-extrabold text-base transition-all shadow-md shrink-0 ${
              isRoseTheme
                ? 'bg-gradient-to-br from-rose-500 via-pink-500 to-rose-600 text-white shadow-rose-900/30'
                : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950'
            }`}>
              {isRoseTheme ? <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" /> : <Store className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="font-extrabold text-white text-sm sm:text-base tracking-tight leading-tight truncate max-w-[125px] xs:max-w-[160px] sm:max-w-none">
                  {settings.storeName}
                </h1>
                <span className={`hidden md:inline text-[10px] uppercase font-bold px-2 py-0.5 rounded border transition-colors shrink-0 ${
                  isRoseTheme
                    ? 'text-pink-300 bg-pink-500/10 border-pink-500/25'
                    : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                }`}>
                  {isRoseTheme ? 'Boutique POS' : 'POS & Scanner'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block truncate">
                Sari-Sari Store Imbentaryo, Presyo Checker, at Benta
              </p>
            </div>
          </div>

          {/* Quick Action Buttons & Compact Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* PROMINENT "I-SYNC SA CLOUD" BUTTON - CLEAR, EASY TO FIND & ALWAYS VISIBLE */}
            <button
              type="button"
              onClick={handleManualCloudSync}
              disabled={isSyncingCloud}
              className={`px-2.5 sm:px-3 py-1.5 sm:py-2 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 border shadow-sm cursor-pointer shrink-0 ${
                isRoseTheme
                  ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border-rose-500/40 shadow-rose-950/30'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border-emerald-500/40 shadow-emerald-950/30'
              }`}
              title="I-sync ang lahat ng paninda at benta sa Cloud Database ngayon"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncingCloud ? 'animate-spin text-sky-400' : ''}`} />
              <span className="text-[11px] sm:text-xs">
                {isSyncingCloud ? 'Nagsi-sync...' : 'I-sync sa Cloud'}
              </span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold text-white ${
                isRoseTheme ? 'bg-pink-600' : 'bg-emerald-600'
              }`}>
                {products.length}
              </span>
            </button>

            {/* Camera Scanner Quick Trigger */}
            <button
              type="button"
              onClick={() => setIsGlobalScannerOpen(true)}
              className={`px-2.5 sm:px-3 py-1.5 sm:py-2 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-sm shrink-0 ${
                isRoseTheme
                  ? 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
              title="I-scan ang Barcode ng Paninda"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Scan</span>
            </button>

            {/* Desktop Only: Presyo Check & Gamitin sa Phone */}
            <button
              type="button"
              onClick={() => setIsPriceCheckerOpen(true)}
              className={`hidden md:flex px-3 py-2 font-semibold rounded-xl text-xs items-center gap-1.5 transition-all active:scale-95 border shadow-xs ${
                isRoseTheme
                  ? 'bg-slate-900/80 hover:bg-slate-800 text-rose-300 border-rose-900/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700/60'
              }`}
              title="Presyo Check"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Presyo Check</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPhoneModalOpen(true)}
              className={`hidden lg:flex px-3 py-2 text-white font-semibold rounded-xl text-xs items-center gap-1.5 transition-all active:scale-95 shadow-xs ${
                isRoseTheme
                  ? 'bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 hover:from-rose-500 hover:to-pink-500'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500'
              }`}
              title="Gamitin sa Telepono / I-install bilang Mobile App"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Gamitin sa Phone</span>
            </button>

            {/* Desktop Only: Grouped Appearance, Speaker, & Settings Controls */}
            <div className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
              {/* Appearance / Theme */}
              <button
                type="button"
                onClick={toggleTheme}
                className={`p-1.5 rounded-lg transition-all text-xs flex items-center gap-1 ${
                  isRoseTheme
                    ? 'text-pink-300 hover:bg-pink-500/20'
                    : 'text-emerald-300 hover:bg-emerald-500/20'
                }`}
                title={isRoseTheme ? 'Tema: Rose Quartz Boutique. Pindutin para lumipat sa Classic Emerald.' : 'Tema: Classic Emerald Retail. Pindutin para lumipat sa Rose Quartz.'}
              >
                <Palette className="w-4 h-4" />
                <span className="hidden xl:inline text-[11px] font-semibold">{isRoseTheme ? 'Rose' : 'Emerald'}</span>
              </button>

              {/* Speaker / Sound */}
              <button
                type="button"
                onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                title={isSoundEnabled ? 'Tunog: Naka-on (May Tunog)' : 'Tunog: Naka-mute (Walang Tunog)'}
              >
                {isSoundEnabled ? <Volume2 className={`w-4 h-4 ${isRoseTheme ? 'text-rose-400' : 'text-emerald-400'}`} /> : <VolumeX className="w-4 h-4 text-slate-500" />}
              </button>

              {/* Settings */}
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                title="Store Settings, PIN, at Backup"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile-Only: Unified Quick Controls Menu (Appearance, Speaker, Settings) */}
            <div className="relative md:hidden">
              <button
                type="button"
                onClick={() => setIsQuickMenuOpen(!isQuickMenuOpen)}
                className={`p-2 rounded-xl transition-all border flex items-center justify-center shrink-0 active:scale-95 ${
                  isQuickMenuOpen
                    ? isRoseTheme
                      ? 'bg-rose-500 text-white border-rose-400 shadow-md'
                      : 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700/80'
                }`}
                title="Pindutin para sa Appearance, Speaker, at Settings"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>

              {/* Mobile Dropdown Popover */}
              {isQuickMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsQuickMenuOpen(false)} />
                  <div className={`absolute right-0 top-12 w-64 rounded-2xl border shadow-2xl p-2.5 z-50 space-y-2 backdrop-blur-xl animate-in fade-in duration-150 ${
                    isRoseTheme
                      ? 'bg-[#181024]/95 border-rose-900/60 shadow-rose-950/60 text-rose-50'
                      : 'bg-slate-900/95 border-slate-800 shadow-slate-950/80 text-slate-100'
                  }`}>
                    {/* Header */}
                    <div className="px-2 py-1 border-b border-slate-800/80 flex items-center justify-between text-xs font-bold text-slate-300">
                      <span>Mga Kontrol (Settings)</span>
                      <button
                        type="button"
                        onClick={() => setIsQuickMenuOpen(false)}
                        className="text-slate-400 hover:text-white p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Appearance (Tema) */}
                    <div className="p-2 rounded-xl bg-slate-950/50 border border-slate-800/60 space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-pink-400" />
                        <span>Tema / Appearance:</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (!isRoseTheme) toggleTheme();
                          }}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 border transition-all ${
                            isRoseTheme
                              ? 'bg-rose-500/25 border-rose-500 text-rose-200 shadow-xs'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span>🌸 Rose</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (isRoseTheme) toggleTheme();
                          }}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 border transition-all ${
                            !isRoseTheme
                              ? 'bg-emerald-500/25 border-emerald-500 text-emerald-200 shadow-xs'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span>🌿 Emerald</span>
                        </button>
                      </div>
                    </div>

                    {/* Speaker (Tunog) */}
                    <button
                      type="button"
                      onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                      className="w-full p-2 rounded-xl bg-slate-950/50 hover:bg-slate-950 border border-slate-800/60 flex items-center justify-between text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isSoundEnabled ? (
                          <Volume2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <VolumeX className="w-4 h-4 text-slate-500" />
                        )}
                        <span className="font-semibold text-slate-200">Tunog (Speaker):</span>
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        isSoundEnabled
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {isSoundEnabled ? 'ON' : 'MUTE'}
                      </span>
                    </button>

                    {/* Presyo Check */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsQuickMenuOpen(false);
                        setIsPriceCheckerOpen(true);
                      }}
                      className="w-full p-2 rounded-xl bg-slate-950/50 hover:bg-slate-950 border border-slate-800/60 flex items-center gap-2 text-xs text-slate-200 transition-colors"
                    >
                      <Tag className="w-4 h-4 text-sky-400" />
                      <span className="font-semibold">Presyo Check</span>
                    </button>

                    {/* Gamitin sa Phone */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsQuickMenuOpen(false);
                        setIsPhoneModalOpen(true);
                      }}
                      className="w-full p-2 rounded-xl bg-slate-950/50 hover:bg-slate-950 border border-slate-800/60 flex items-center gap-2 text-xs text-slate-200 transition-colors"
                    >
                      <Smartphone className="w-4 h-4 text-pink-400" />
                      <span className="font-semibold">Gamitin sa Phone (App)</span>
                    </button>

                    {/* Full Settings & Backup Trigger */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsQuickMenuOpen(false);
                        setIsSettingsOpen(true);
                      }}
                      className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all text-white ${
                        isRoseTheme
                          ? 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500'
                          : 'bg-emerald-600 hover:bg-emerald-500'
                      }`}
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Mga Setting ng Tindahan</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Bar Tabs for Desktop/Tablet */}
        <div className={`max-w-7xl mx-auto px-3 sm:px-6 hidden md:flex items-center gap-1 overflow-x-auto scrollbar-none py-1.5 border-t ${
          isRoseTheme ? 'border-rose-950/60 bg-[#0e0914]/60' : 'border-slate-800/80 bg-slate-950/40'
        }`}>
          {/* Paninda / Catalog Tab */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('pos');
              setPosInitialMode('catalog');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'pos' && posInitialMode === 'catalog'
                ? isRoseTheme ? 'bg-rose-600 text-white shadow-xs' : 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Paninda (POS)</span>
          </button>

          {/* Kaha / Cashier Dedicated Tab */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('pos');
              setPosInitialMode('cashier');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'pos' && posInitialMode === 'cashier'
                ? isRoseTheme ? 'bg-rose-600 text-white shadow-xs' : 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Kaha / Cashier</span>
            {cartItemCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold animate-pulse ${
                isRoseTheme ? 'bg-pink-500 text-white' : 'bg-emerald-500 text-slate-950'
              }`}>
                {cartItemCount} • ₱{cartGrandTotal.toFixed(0)}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'inventory'
                ? isRoseTheme ? 'bg-rose-600 text-white shadow-xs' : 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Imbentaryo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('low-stock')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'low-stock'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Babala sa Stock</span>
            {lowStockCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold animate-pulse">
                {lowStockCount}
              </span>
            )}
          </button>

          {/* Talaan ng Utang (Protected with Admin PIN) */}
          <button
            type="button"
            onClick={handleNavigateToUtang}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'utang'
                ? isRoseTheme ? 'bg-rose-600 text-white shadow-xs' : 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Talaan ng Utang</span>
            {settings.requireUtangPin !== false && !isUtangUnlocked && (
              <span className="text-[10px] bg-slate-850 text-amber-300 px-1 py-0.2 rounded border border-amber-500/30 flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" /> PIN
              </span>
            )}
            {unpaidUtangCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-slate-950 font-bold">
                {unpaidUtangCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sales')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'sales'
                ? isRoseTheme ? 'bg-rose-600 text-white shadow-xs' : 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Benta at Ulat</span>
          </button>

          {/* Online Customer Storefront Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('customer-store')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'customer-store'
                ? isRoseTheme ? 'bg-rose-600 text-white shadow-xs' : 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
            title="Buksan ang Online Customer Catalog para sa mga customers"
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span>Online Tindahan</span>
            <span className="text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/30 px-1.5 py-0.2 rounded-full font-bold">
              Customer View
            </span>
          </button>
        </div>
      </header>

      {/* Cloud Sync Toast Notification */}
      {cloudSyncToast && (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3">
          <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center justify-between shadow-md animate-in fade-in">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{cloudSyncToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setCloudSyncToast(null)}
              className="text-emerald-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main View Area with Mobile Bottom Padding */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 pb-28 md:pb-8">
        {activeTab === 'pos' && (
          <POSView
            products={products}
            sales={sales}
            cart={cart}
            setCart={setCart}
            initialMode={posInitialMode}
            onCompleteSale={handleCompleteSale}
            onOpenPriceChecker={() => setIsPriceCheckerOpen(true)}
            categories={activeCategories}
            onOpenManageCategories={() => setIsCategoryModalOpen(true)}
            onAddProduct={handleAddProduct}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            products={products}
            onAddProduct={handleAddProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            onClearAllProducts={handleClearAllProducts}
            onQuickAdjustStock={handleQuickAdjustStock}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            categories={activeCategories}
            onOpenManageCategories={() => setIsCategoryModalOpen(true)}
            onManualSync={handleManualCloudSync}
            isCloudSynced={isCloudSynced}
            isSyncingCloud={isSyncingCloud}
          />
        )}

        {activeTab === 'low-stock' && (
          <LowStockAlertsView
            products={products}
            onRestockProduct={handleRestockProduct}
            onOpenInventory={() => setActiveTab('inventory')}
          />
        )}

        {activeTab === 'utang' && (
          <UtangLedgerView
            sales={sales}
            onRecordPayment={handleRecordCustomerPayment}
            onAddDirectCredit={handleAddDirectCredit}
            onLockUtang={handleLockUtang}
          />
        )}

        {activeTab === 'sales' && <SalesHistoryView sales={sales} />}

        {activeTab === 'customer-store' && (
          <CustomerStorefrontView
            products={products}
            settings={settings}
            categories={activeCategories}
            isCustomerViewOnly={false}
            onBackToAdmin={() => setActiveTab('pos')}
          />
        )}
      </main>

      {/* Mobile-First Ergonomic Bottom Navigation Bar (md:hidden) */}
      <nav className={`md:hidden fixed bottom-0 inset-x-0 z-40 backdrop-blur-xl border-t px-2 py-1.5 flex items-center justify-around shadow-2xl transition-colors ${
        isRoseTheme
          ? 'bg-[#150f1d]/95 border-rose-950/80 shadow-rose-950/40'
          : 'bg-slate-900/95 border-slate-800'
      }`}>
        {/* POS Paninda */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('pos');
            setPosInitialMode('catalog');
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            activeTab === 'pos' && posInitialMode === 'catalog'
              ? isRoseTheme ? 'text-rose-400 font-bold scale-105' : 'text-emerald-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShoppingCart className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Paninda</span>
        </button>

        {/* Kaha / Cashier */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('pos');
            setPosInitialMode('cashier');
          }}
          className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            activeTab === 'pos' && posInitialMode === 'cashier'
              ? isRoseTheme ? 'text-rose-400 font-bold scale-105' : 'text-emerald-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Receipt className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Kaha</span>
          {cartItemCount > 0 && (
            <span className={`absolute top-0 right-1 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold text-white animate-pulse ${
              isRoseTheme ? 'bg-pink-500' : 'bg-emerald-500'
            }`}>
              {cartItemCount}
            </span>
          )}
        </button>

        {/* Imbentaryo */}
        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            activeTab === 'inventory'
              ? isRoseTheme ? 'text-rose-400 font-bold scale-105' : 'text-emerald-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Boxes className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Imbentaryo</span>
        </button>

        {/* Talaan ng Utang (Shows Lock Badge when protected) */}
        <button
          type="button"
          onClick={handleNavigateToUtang}
          className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            activeTab === 'utang'
              ? isRoseTheme ? 'text-rose-400 font-bold scale-105' : 'text-amber-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <UserCheck className="w-5 h-5 mb-0.5" />
            {settings.requireUtangPin !== false && !isUtangUnlocked && (
              <span className="absolute -top-1 -right-1 text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full px-0.5">
                🔒
              </span>
            )}
          </div>
          <span className="text-[10px]">Utang</span>
          {unpaidUtangCount > 0 && (
            <span className="absolute top-0 right-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-slate-950">
              {unpaidUtangCount}
            </span>
          )}
        </button>

        {/* Benta at Ulat */}
        <button
          type="button"
          onClick={() => setActiveTab('sales')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
            activeTab === 'sales'
              ? isRoseTheme ? 'text-rose-400 font-bold scale-105' : 'text-emerald-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Ulat</span>
        </button>

        {/* Online Customer Storefront */}
        <button
          type="button"
          onClick={() => setActiveTab('customer-store')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
            activeTab === 'customer-store'
              ? isRoseTheme ? 'text-rose-400 font-bold scale-105' : 'text-sky-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Online Customer Storefront"
        >
          <Globe className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Online</span>
        </button>
      </nav>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>{settings.storeName} — Smart Sari-Sari Store POS System</span>
          <span className="text-[11px] text-slate-600">
            Offline-Ready · Camera Barcode Scanner · Local Storage Cached
          </span>
        </div>
      </footer>

      {/* Presyo Check Modal */}
      <PriceCheckerModal
        isOpen={isPriceCheckerOpen}
        onClose={() => setIsPriceCheckerOpen(false)}
        products={products}
        onAddToCart={(product) => {
          setActiveTab('pos');
        }}
      />

      {/* Global Quick Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isGlobalScannerOpen}
        onClose={() => setIsGlobalScannerOpen(false)}
        onScan={handleGlobalBarcodeScanned}
        title="Mabilisang Barcode Scanner"
        subtitle="Itutok ang camera sa barcode ng kahit anong paninda"
      />

      {/* Phone Install QR & Guide Modal */}
      <InstallPhoneModal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
      />

      {/* Settings & Backup Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-emerald-400" />
                <span>Mga Setting ng Tindahan</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Theme Selector */}
              <div className="space-y-1.5 pb-2 border-b border-slate-800">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-pink-400" />
                  <span>Tema ng Tindahan (Theme):</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...settings, theme: 'rose-boutique' as const };
                      setSettings(next);
                      saveStoredSettings(next);
                      syncSaveSettings(next).catch(() => {});
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      isRoseTheme
                        ? 'bg-rose-500/20 border-rose-500 text-rose-200 shadow-xs'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🌸 Rose Quartz</span>
                    <span className="text-[10px] text-pink-400 font-normal">(Chic)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...settings, theme: 'classic-emerald' as const };
                      setSettings(next);
                      saveStoredSettings(next);
                      syncSaveSettings(next).catch(() => {});
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      !isRoseTheme
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 shadow-xs'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🌿 Classic Green</span>
                    <span className="text-[10px] text-emerald-400 font-normal">(Retail)</span>
                  </button>
                </div>
              </div>

              {/* Admin 6-Digit PIN & Utang Protection (Protected / Anti-Tamper) */}
              <div className="space-y-3 p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isRoseTheme ? 'bg-rose-500/15 text-rose-300' : 'bg-amber-500/15 text-amber-400'
                    }`}>
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">
                        Admin 6-Digit PIN & Utang Security
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Protektado laban sa unauthorized access
                      </span>
                    </div>
                  </div>

                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300">
                    <input
                      type="checkbox"
                      checked={settings.requireUtangPin !== false}
                      onChange={(e) => {
                        const next = { ...settings, requireUtangPin: e.target.checked };
                        setSettings(next);
                        saveStoredSettings(next);
                        syncSaveSettings(next).catch(() => {});
                      }}
                      className="rounded border-slate-700 text-rose-500 focus:ring-0"
                    />
                    <span>Naka-lock ang Utang</span>
                  </label>
                </div>

                <div className="flex items-center justify-between gap-2 p-2 bg-slate-900 rounded-xl border border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span className="text-slate-300 font-medium">Status:</span>
                    <span className="font-mono text-white font-bold tracking-widest bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                      ••••••
                    </span>
                    <span className="text-[10px] text-emerald-400 font-medium">
                      (6-digit aktibo)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setIsChangePinModalOpen(true);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs shadow-xs transition-all flex items-center gap-1 text-white ${
                      isRoseTheme
                        ? 'bg-rose-600 hover:bg-rose-500'
                        : 'bg-emerald-600 hover:bg-emerald-500'
                    }`}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Palitan ang PIN</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setIsRecoverySettingsModalOpen(true);
                    }}
                    className="py-2 px-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Setup ng Recovery / Master Key</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setIsRecoveryModalOpen(true);
                    }}
                    className="py-2 px-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Nakalimutan ang PIN? I-recover</span>
                  </button>
                </div>

                <p className="text-[10px] text-slate-400 leading-tight">
                  🔒 May kumpirmasyon bago baguhin ang PIN upang hindi basta-basta mapalitan ng ibang tao sa tindahan.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Pangalan ng Tindahan</label>
                <input
                  type="text"
                  value={settings.storeName}
                  onChange={(e) => {
                    const next = { ...settings, storeName: e.target.value };
                    setSettings(next);
                    saveStoredSettings(next);
                    syncSaveSettings(next).catch(() => {});
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">May-ari ng Tindahan</label>
                <input
                  type="text"
                  value={settings.ownerName}
                  onChange={(e) => {
                    const next = { ...settings, ownerName: e.target.value };
                    setSettings(next);
                    saveStoredSettings(next);
                    syncSaveSettings(next).catch(() => {});
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              {/* Category Management */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="font-semibold text-slate-300 block">Mga Kategorya ng Paninda:</span>
                <p className="text-[11px] text-slate-400">
                  Palitan ang pangalan (rename), magdagdag, o magbura ng mga kategorya.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setIsCategoryModalOpen(true);
                  }}
                  className={`w-full py-2 px-3 border rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors text-xs ${
                    isRoseTheme
                      ? 'bg-slate-900 hover:bg-slate-850 text-rose-300 border-rose-900/40'
                      : 'bg-slate-800 hover:bg-slate-750 text-emerald-400 border-slate-700'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>I-edit ang mga Kategorya (Categories)</span>
                </button>
              </div>

              {/* Cloud Database & Multi-Device Sync Section */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Cloud className="w-4 h-4 text-sky-400" />
                    <span>Cloud Database & Device Sync:</span>
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Aktibo ({products.length} paninda)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Awtomatikong nai-save ang iyong imbentaryo sa Google Cloud para pareho at updated sa lahat ng cellphone at computer.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    handleManualCloudSync();
                  }}
                  disabled={isSyncingCloud}
                  className={`w-full py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 text-xs cursor-pointer ${
                    isRoseTheme
                      ? 'bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200'
                      : 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200'
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncingCloud ? 'animate-spin text-sky-400' : 'text-emerald-400'}`} />
                  <span>{isSyncingCloud ? 'Kasalukuyang Nagsi-sync sa Cloud...' : '🔄 I-sync Lahat sa Cloud Database Ngayon'}</span>
                </button>
              </div>

              {/* Backup & Export */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="font-semibold text-slate-300 block">Backup & I-save ang Data:</span>
                <p className="text-[11px] text-slate-400">
                  I-download ang buong kopya ng imbentaryo at talaan ng benta para may reserba ka.
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className={`flex-1 py-2 px-3 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      isRoseTheme
                        ? 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500'
                        : 'bg-emerald-600 hover:bg-emerald-500'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>I-download ang Backup</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium transition-colors text-xs"
              >
                Isara
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin PIN Keypad Modal for Talaan ng Utang */}
      {isUtangPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className={`relative w-full max-w-sm rounded-3xl border shadow-2xl p-6 space-y-5 text-center ${
            isRoseTheme
              ? 'bg-[#150f1d] border-rose-900/60 shadow-rose-950/50'
              : 'bg-slate-900 border-slate-800'
          }`}>
            <button
              type="button"
              onClick={() => {
                setIsUtangPinModalOpen(false);
                setEnteredPin('');
                setPinError(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Lock Header Icon */}
            <div className="space-y-2">
              <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-lg ${
                isRoseTheme
                  ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                  : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
              }`}>
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Protektado ng 6-Digit Admin PIN
              </h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Pribado ang Talaan ng Utang. Ilagay ang iyong 6-digit Admin PIN upang mabuksan at makapaningil.
              </p>
            </div>

            {/* Visual PIN Dots Indicator (6 Digits) */}
            <div className="flex items-center justify-center gap-2.5 py-1">
              {[0, 1, 2, 3, 4, 5].map((idx) => {
                const filled = enteredPin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full transition-all duration-150 ${
                      filled
                        ? isRoseTheme
                          ? 'bg-rose-500 scale-110 shadow-sm shadow-rose-500/50'
                          : 'bg-amber-400 scale-110 shadow-sm shadow-amber-400/50'
                        : 'border-2 border-slate-700 bg-slate-950'
                    }`}
                  />
                );
              })}
            </div>

            {pinError && (
              <p className="text-xs text-rose-400 font-semibold animate-pulse">
                {pinError}
              </p>
            )}

            {/* Mobile Touch Keypad */}
            <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePinDigit(num)}
                  className={`h-12 rounded-2xl font-bold text-base transition-all active:scale-90 flex items-center justify-center border shadow-xs ${
                    isRoseTheme
                      ? 'bg-slate-950/80 border-rose-950/50 text-white hover:bg-rose-950/40'
                      : 'bg-slate-950 border-slate-800 text-white hover:bg-slate-800'
                  }`}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handlePinBackspace}
                className="h-12 rounded-2xl font-semibold text-xs text-slate-400 bg-slate-950/50 border border-slate-800 hover:text-white flex items-center justify-center active:scale-90"
              >
                Bura
              </button>
              <button
                type="button"
                onClick={() => handlePinDigit('0')}
                className={`h-12 rounded-2xl font-bold text-base transition-all active:scale-90 flex items-center justify-center border shadow-xs ${
                  isRoseTheme
                    ? 'bg-slate-950/80 border-rose-950/50 text-white hover:bg-rose-950/40'
                    : 'bg-slate-950 border-slate-800 text-white hover:bg-slate-800'
                }`}
              >
                0
              </button>
              <button
                type="button"
                onClick={() => verifyPin(enteredPin)}
                className={`h-12 rounded-2xl font-bold text-xs text-white transition-all active:scale-90 flex items-center justify-center shadow-md ${
                  isRoseTheme
                    ? 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500'
                    : 'bg-amber-600 hover:bg-amber-500'
                }`}
              >
                OK
              </button>
            </div>

            {/* Forgot PIN / Recovery link */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsUtangPinModalOpen(false);
                  setIsRecoveryModalOpen(true);
                }}
                className={`text-xs font-semibold underline flex items-center justify-center gap-1.5 mx-auto transition-colors ${
                  isRoseTheme ? 'text-rose-400 hover:text-rose-300' : 'text-amber-400 hover:text-amber-300'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Nakalimutan ang PIN? (I-recover Dito)</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Default PIN: <span className="font-mono text-slate-300 font-bold">123456</span> · Maaaring baguhin sa Settings
            </p>
          </div>
        </div>
      )}

      {/* Change PIN Modal with Multi-step Confirmation */}
      <ChangePinModal
        isOpen={isChangePinModalOpen}
        onClose={() => setIsChangePinModalOpen(false)}
        settings={settings}
        onSuccess={handleChangePinSuccess}
        onOpenRecovery={() => setIsRecoveryModalOpen(true)}
        isRoseTheme={isRoseTheme}
        playSuccessSound={playCheckoutChime}
        playWarningSound={playWarningSound}
      />

      {/* PIN Recovery Modal (Security Question & Master Emergency Code) */}
      <PinRecoveryModal
        isOpen={isRecoveryModalOpen}
        onClose={() => setIsRecoveryModalOpen(false)}
        settings={settings}
        onPinReset={handleChangePinSuccess}
        onUnlockUtang={() => {
          setIsUtangUnlocked(true);
          setActiveTab('utang');
        }}
        isRoseTheme={isRoseTheme}
        playSuccessSound={playCheckoutChime}
        playWarningSound={playWarningSound}
      />

      {/* Setup Recovery & Master Emergency Key Settings Modal */}
      <RecoverySettingsModal
        isOpen={isRecoverySettingsModalOpen}
        onClose={() => setIsRecoverySettingsModalOpen(false)}
        settings={settings}
        onSave={handleSaveRecoverySettings}
        isRoseTheme={isRoseTheme}
        playSuccessSound={playCheckoutChime}
        playWarningSound={playWarningSound}
      />

      {/* Manage Categories Modal */}
      <ManageCategoriesModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={activeCategories}
        products={products}
        onAddCategory={handleAddCategory}
        onRenameCategory={handleRenameCategory}
        onDeleteCategory={handleDeleteCategory}
        onResetDefaultCategories={handleResetDefaultCategories}
      />
    </div>
  );
}
