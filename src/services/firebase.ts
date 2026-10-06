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
 * Seed initial sample products to Firestore if collection is empty or missing items
 */
export async function seedInitialFirestoreData(): Promise<void> {
  try {
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);
    const existingIds = new Set(snapshot.docs.map((d) => d.id));
    const existingBarcodes = new Set(snapshot.docs.map((d) => (d.data() as Product).barcode));

    const batch = writeBatch(db);
    let writes = 0;

    // Seed settings if missing
    const settingsDoc = await getDocFromServer(doc(db, 'settings', 'store')).catch(() => null);
    if (!settingsDoc || !settingsDoc.exists()) {
      batch.set(doc(db, 'settings', 'store'), DEFAULT_SETTINGS);
      writes++;
    }

    // Ensure all 24 INITIAL_PRODUCTS across all categories exist in Firestore
    INITIAL_PRODUCTS.forEach((prod) => {
      if (!existingIds.has(prod.id) && !existingBarcodes.has(prod.barcode)) {
        const prodRef = doc(db, 'products', prod.id);
        batch.set(prodRef, prod);
        writes++;
      }
    });

    // Backfill image URLs and ensure clean data
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Product;
      const initial = INITIAL_PRODUCTS.find((p) => p.id === docSnap.id || p.barcode === data.barcode);
      if (initial) {
        let needsUpdate = false;
        const updates: Partial<Product> = {};
        if (initial.imageUrl && (!data.imageUrl || data.imageUrl === '')) {
          updates.imageUrl = initial.imageUrl;
          needsUpdate = true;
        }
        if (needsUpdate) {
          batch.update(docSnap.ref, updates);
          writes++;
        }
      }
    });

    if (writes > 0) {
      await batch.commit();
      console.log(`Successfully synced/seeded ${writes} products to Cloud Firestore!`);
    }
  } catch (err) {
    console.warn('Error during Firestore seed:', err);
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
  await setDoc(prodRef, product, { merge: true });
}

/**
 * Delete a product from Firestore
 */
export async function syncDeleteProduct(productId: string): Promise<void> {
  const prodRef = doc(db, 'products', productId);
  await deleteDoc(prodRef);
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
  batch.set(saleRef, sale);

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
export async function syncSettleCredit(transactionId: string): Promise<void> {
  const saleRef = doc(db, 'sales', transactionId);
  await setDoc(
    saleRef,
    {
      isCreditSettled: true,
      creditSettledDate: new Date().toISOString(),
    },
    { merge: true }
  );
}

/**
 * Save store settings to Firestore
 */
export async function syncSaveSettings(settings: StoreSettings): Promise<void> {
  const settingsRef = doc(db, 'settings', 'store');
  await setDoc(settingsRef, settings, { merge: true });
}
