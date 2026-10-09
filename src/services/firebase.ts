import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDocFromServer,
  writeBatch,
} from 'firebase/firestore';
import { Product, SaleTransaction, StoreSettings } from '../types';
import { INITIAL_PRODUCTS, DEFAULT_SETTINGS, isSampleProductId } from '../utils/sampleData';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with specific database ID if configured
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Test Firestore connection on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'settings', 'store'));
    return true;
  } catch (error) {
    console.warn('Firestore connection check notice:', error);
    return false;
  }
}

/**
 * Helper to remove undefined fields and convert NaN to valid numbers before saving to Firestore.
 * Firestore setDoc/batch.set crashes with "Unsupported field value: undefined" or "NaN".
 */
export function cleanForFirestore<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (typeof value === 'number') {
      result[key] = Number.isNaN(value) ? 0 : value;
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null && typeof item === 'object' && !(item instanceof Date)
          ? cleanForFirestore(item)
          : typeof item === 'number' && Number.isNaN(item)
          ? 0
          : item
      );
    } else if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      result[key] = cleanForFirestore(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * Ensure Firestore metadata and default settings are initialized.
 * GUARANTEE: Never automatically seeds or resurrects sample products!
 * The user's inventory belongs solely to them. Sample products will NEVER be auto-injected.
 */
export async function seedInitialFirestoreData(): Promise<void> {
  try {
    const initMetaRef = doc(db, 'settings', 'initialization');
    const settingsDocRef = doc(db, 'settings', 'store');

    // Mark initialization permanently so auto-seeding is forever disabled
    await setDoc(
      initMetaRef,
      { hasCompletedInitialSeed: true, preventAutoSeed: true, updatedAt: new Date().toISOString() },
      { merge: true }
    );

    // If store settings do not exist yet, create default settings
    const settingsDoc = await getDocFromServer(settingsDocRef).catch(() => null);
    if (!settingsDoc || !settingsDoc.exists()) {
      await setDoc(settingsDocRef, cleanForFirestore(DEFAULT_SETTINGS), { merge: true });
    }
  } catch (err) {
    console.warn('Notice during Firestore initialization check:', err);
  }
}

/**
 * Demo sample products are permanently disabled.
 */
export async function loadSampleProductsDemo(): Promise<void> {
  // Permanently disabled
}

/**
 * Real-time listener for products across all phones & computers
 */
export function subscribeToProducts(
  onUpdate: (products: Product[]) => void,
  onError?: (err: Error) => void
) {
  const productsRef = collection(db, 'products');
  return onSnapshot(
    productsRef,
    (snapshot) => {
      const items: Product[] = [];
      snapshot.forEach((docSnap) => {
        const p = { ...(docSnap.data() as Product), id: docSnap.id };
        // Never import legacy 24 demo items
        if (isSampleProductId(p.id)) {
          return;
        }
        items.push(p);
      });

      // Sort alphabetically by name
      items.sort((a, b) => a.name.localeCompare(b.name));
      onUpdate(items);
    },
    (err) => {
      console.error('Real-time products sync error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Real-time listener for sales transactions across all phones
 */
export function subscribeToSales(
  onUpdate: (sales: SaleTransaction[]) => void,
  onError?: (err: Error) => void
) {
  const salesRef = collection(db, 'sales');
  return onSnapshot(
    salesRef,
    (snapshot) => {
      const items: SaleTransaction[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ ...(docSnap.data() as SaleTransaction), id: docSnap.id });
      });

      // Sort newest first
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onUpdate(items);
    },
    (err) => {
      console.error('Real-time sales sync error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Real-time listener for store settings
 */
export function subscribeToSettings(
  onUpdate: (settings: StoreSettings) => void
) {
  const settingsDocRef = doc(db, 'settings', 'store');
  return onSnapshot(settingsDocRef, (docSnap) => {
    if (docSnap.exists()) {
      onUpdate(docSnap.data() as StoreSettings);
    } else {
      onUpdate(DEFAULT_SETTINGS);
    }
  });
}

/**
 * Save / Update a product to Firestore (instant sync to all phones)
 */
export async function syncSaveProduct(product: Product): Promise<void> {
  const prodRef = doc(db, 'products', product.id);
  const safeProduct = cleanForFirestore(product);
  await setDoc(prodRef, safeProduct, { merge: true });
}

/**
 * Delete a product from Firestore
 */
export async function syncDeleteProduct(productId: string): Promise<void> {
  const prodRef = doc(db, 'products', productId);
  await deleteDoc(prodRef);
}

/**
 * Delete ALL products from Firestore in a batch write (e.g. user clearing sample products)
 */
export async function syncClearAllProducts(): Promise<void> {
  try {
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
    console.log(`Successfully cleared ${snapshot.docs.length} products from Cloud Firestore.`);
  } catch (err) {
    console.error('Error clearing products in Firestore:', err);
    throw err;
  }
}

/**
 * Record a sale and update stock quantities in Firestore simultaneously
 */
export async function syncRecordSale(
  sale: SaleTransaction,
  currentProducts: Product[]
): Promise<void> {
  const batch = writeBatch(db);

  // 1. Add sale document
  const saleRef = doc(db, 'sales', sale.id);
  const safeSale = cleanForFirestore(sale);
  batch.set(saleRef, safeSale);

  // 2. Deduct inventory for each purchased item
  sale.items.forEach((item) => {
    const existing = currentProducts.find((p) => p.id === item.productId);
    if (existing) {
      const remainingStock = Math.max(0, existing.stock - item.quantity);
      const prodRef = doc(db, 'products', item.productId);
      batch.update(prodRef, {
        stock: remainingStock,
        updatedAt: new Date().toISOString(),
      });
    }
  });

  await batch.commit();
}

/**
 * Settle an utang transaction in Firestore
 */
export async function syncSettleCredit(
  transactionId: string,
  settledDate: string = new Date().toISOString()
): Promise<void> {
  const saleRef = doc(db, 'sales', transactionId);
  await setDoc(
    saleRef,
    {
      isCreditSettled: true,
      creditSettledDate: settledDate,
    },
    { merge: true }
  );
}

/**
 * Update any fields on a sale or credit transaction in Firestore
 */
export async function syncUpdateSaleTransaction(
  transactionId: string,
  updates: Partial<SaleTransaction>
): Promise<void> {
  const saleRef = doc(db, 'sales', transactionId);
  const safeUpdates = cleanForFirestore(updates);
  await setDoc(saleRef, safeUpdates, { merge: true });
}

/**
 * Batch update multiple sales transactions in Firestore
 */
export async function syncBatchUpdateSales(
  transactions: SaleTransaction[]
): Promise<void> {
  const batch = writeBatch(db);
  transactions.forEach((tx) => {
    const sRef = doc(db, 'sales', tx.id);
    const safeTx = cleanForFirestore(tx);
    batch.set(sRef, safeTx, { merge: true });
  });
  await batch.commit();
}

/**
 * Save store settings to Firestore
 */
export async function syncSaveSettings(settings: StoreSettings): Promise<void> {
  const settingsRef = doc(db, 'settings', 'store');
  const safeSettings = cleanForFirestore(settings);
  await setDoc(settingsRef, safeSettings, { merge: true });
}
