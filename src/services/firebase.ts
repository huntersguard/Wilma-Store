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
import { INITIAL_PRODUCTS, DEFAULT_SETTINGS } from '../utils/sampleData';
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
 * Helper to remove undefined fields from objects before saving to Firestore.
 * Firestore setDoc/batch.set crashes with "Unsupported field value: undefined".
 */
export function cleanForFirestore<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null && typeof item === 'object' && !(item instanceof Date)
          ? cleanForFirestore(item)
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
 * Seed initial sample products to Firestore ONCE only on a brand new virgin database.
 * If the database was already initialized or already has settings/products, this NEVER re-seeds or overwrites user changes!
 */
export async function seedInitialFirestoreData(): Promise<void> {
  try {
    const initMetaRef = doc(db, 'settings', 'initialization');
    const initDoc = await getDocFromServer(initMetaRef).catch(() => null);

    // If marked initialized already, DO NOT touch or re-seed anything!
    if (initDoc && initDoc.exists()) {
      return;
    }

    // Check if store settings already exist (store was already set up previously)
    const settingsDocRef = doc(db, 'settings', 'store');
    const settingsDoc = await getDocFromServer(settingsDocRef).catch(() => null);

    if (settingsDoc && settingsDoc.exists()) {
      // Store settings already present! Mark initialization so sample products are NEVER resurrected.
      await setDoc(
        initMetaRef,
        { hasCompletedInitialSeed: true, initializedAt: new Date().toISOString() },
        { merge: true }
      );
      return;
    }

    // Check if products collection already has any records
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);

    if (!snapshot.empty) {
      // Products already exist in database! Mark initialization and never re-seed.
      await setDoc(
        initMetaRef,
        { hasCompletedInitialSeed: true, initializedAt: new Date().toISOString() },
        { merge: true }
      );
      return;
    }

    // Only if brand new database with NO settings and NO products:
    const batch = writeBatch(db);
    batch.set(settingsDocRef, cleanForFirestore(DEFAULT_SETTINGS));
    batch.set(initMetaRef, { hasCompletedInitialSeed: true, initializedAt: new Date().toISOString() });

    INITIAL_PRODUCTS.forEach((prod) => {
      const prodRef = doc(db, 'products', prod.id);
      batch.set(prodRef, cleanForFirestore(prod));
    });

    await batch.commit();
    console.log('Brand new database initialized successfully.');
  } catch (err) {
    console.warn('Notice during Firestore initialization check:', err);
  }
}

/**
 * Real-time listener for products across all phones
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
        items.push({ ...(docSnap.data() as Product), id: docSnap.id });
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
