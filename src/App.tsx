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
  syncRecordSale,
  syncSettleCredit,
  syncSaveSettings,
} from './services/firebase';
import { POSView, POSMode } from './components/POSView';
import { InventoryView } from './components/InventoryView';
import { LowStockAlertsView } from './components/LowStockAlertsView';
import { UtangLedgerView } from './components/UtangLedgerView';
import { SalesHistoryView } from './components/SalesHistoryView';
import { PriceCheckerModal } from './components/PriceCheckerModal';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { InstallPhoneModal } from './components/InstallPhoneModal';
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
} from 'lucide-react';
import { playScanBeep, playWarningSound } from './utils/audio';

type ActiveTab = 'pos' | 'inventory' | 'low-stock' | 'utang' | 'sales';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [posInitialMode, setPosInitialMode] = useState<POSMode>('catalog');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>(getStoredProducts());
  const [sales, setSales] = useState<SaleTransaction[]>(getStoredSales());
  const [settings, setSettings] = useState<StoreSettings>(getStoredSettings());
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);

  // Global modals
  const [isPriceCheckerOpen, setIsPriceCheckerOpen] = useState(false);
  const [isGlobalScannerOpen, setIsGlobalScannerOpen] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

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

        // Real-time listener for products across all phones
        unsubscribeProducts = subscribeToProducts((cloudProducts) => {
          if (cloudProducts.length > 0) {
            setProducts(cloudProducts);
            saveStoredProducts(cloudProducts);
          }
        });

        // Real-time listener for sales across all phones
        unsubscribeSales = subscribeToSales((cloudSales) => {
          setSales(cloudSales);
          saveStoredSales(cloudSales);
        });

        // Real-time listener for store settings
        unsubscribeSettings = subscribeToSettings((cloudSettings) => {
          setSettings(cloudSettings);
          saveStoredSettings(cloudSettings);
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

  // Update products & save
  const handleAddProduct = async (newProd: Omit<Product, 'id' | 'updatedAt'>) => {
    const created: Product = {
      ...newProd,
      id: `prod-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    const updated = [created, ...products];
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

  // Settle credit from Utang ledger
  const handleSettleCredit = async (transactionId: string) => {
    const updatedSales = sales.map((s) => {
      if (s.id === transactionId) {
        return {
          ...s,
          isCreditSettled: true,
          creditSettledDate: new Date().toISOString(),
        };
      }
      return s;
    });
    setSales(updatedSales);
    saveStoredSales(updatedSales);

    try {
      await syncSettleCredit(transactionId);
    } catch (err) {
      console.warn('Cloud sync settle credit fallback:', err);
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

  // Low stock counter
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
  const unpaidUtangCount = sales.filter((s) => s.paymentMethod === 'utang' && !s.isCreditSettled).length;
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartGrandTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Application Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Logo & Store Branding */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 shadow-md font-extrabold text-base">
              <Store className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-white text-sm sm:text-base tracking-tight leading-tight">
                  {settings.storeName}
                </h1>
                <span className="hidden md:inline text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  POS & Scanner
                </span>
                {/* Real-time Multi-phone Sync Status */}
                <span
                  className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                    isCloudSynced
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}
                  title={
                    isCloudSynced
                      ? 'Multi-Phone Cloud Sync is ACTIVE! Lahat ng phone ay may parehong data.'
                      : 'Kumokonekta sa Cloud Database...'
                  }
                >
                  <Cloud className="w-3 h-3" />
                  <span>{isCloudSynced ? 'Live Cloud Sync' : 'Connecting...'}</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Sari-Sari Store Imbentaryo, Presyo Checker, at Benta
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Gamitin sa Phone Button */}
            <button
              type="button"
              onClick={() => setIsPhoneModalOpen(true)}
              className="px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-xs"
              title="Gamitin sa Telepono / I-install bilang Mobile App"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Gamitin sa Phone</span>
            </button>

            {/* Presyo Check Button */}
            <button
              type="button"
              onClick={() => setIsPriceCheckerOpen(true)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 border border-slate-700/60 shadow-xs"
              title="Presyo Check"
            >
              <Tag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Presyo Check</span>
            </button>

            {/* Camera Scanner Quick Trigger */}
            <button
              type="button"
              onClick={() => setIsGlobalScannerOpen(true)}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
              title="I-scan ang Barcode"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Scan Barcode</span>
            </button>

            {/* Sound Toggle */}
            <button
              type="button"
              onClick={() => setIsSoundEnabled(!isSoundEnabled)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title={isSoundEnabled ? 'Tunog: Naka-on' : 'Tunog: Naka-off'}
            >
              {isSoundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>

            {/* Settings & Backup Modal Trigger */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title="Store Settings & Backup"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Bar Tabs */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center gap-1 overflow-x-auto scrollbar-none py-1.5 border-t border-slate-800/80 bg-slate-950/40">
          {/* Paninda / Catalog Tab */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('pos');
              setPosInitialMode('catalog');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'pos' && posInitialMode === 'catalog'
                ? 'bg-emerald-600 text-white shadow-xs'
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
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Kaha / Cashier</span>
            {cartItemCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500 text-slate-950 font-extrabold animate-pulse">
                {cartItemCount} • ₱{cartGrandTotal.toFixed(0)}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'inventory'
                ? 'bg-emerald-600 text-white shadow-xs'
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

          <button
            type="button"
            onClick={() => setActiveTab('utang')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'utang'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Talaan ng Utang</span>
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
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Benta at Ulat</span>
          </button>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6">
        {activeTab === 'pos' && (
          <POSView
            products={products}
            cart={cart}
            setCart={setCart}
            initialMode={posInitialMode}
            onCompleteSale={handleCompleteSale}
            onOpenPriceChecker={() => setIsPriceCheckerOpen(true)}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            products={products}
            onAddProduct={handleAddProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            onQuickAdjustStock={handleQuickAdjustStock}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onResetDefaults={handleResetDefaults}
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
          <UtangLedgerView sales={sales} onSettleCredit={handleSettleCredit} />
        )}

        {activeTab === 'sales' && <SalesHistoryView sales={sales} />}
      </main>

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
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors"
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
    </div>
  );
}
