import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore'
import {
  getStorage,
  ref,
  uploadString,
  getDownloadURL,
} from 'firebase/storage'

// Firebase configuration: prefer window.__FIREBASE_CONFIG__ if set in index.html
// This lets you embed config in index.html as:
// <script>window.__FIREBASE_CONFIG__ = { ... }</script>
const firebaseConfig = (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__)
  ? window.__FIREBASE_CONFIG__
  : {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_AUTH_DOMAIN",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_STORAGE_BUCKET",
      messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
      appId: "YOUR_APP_ID",
    };

// Initialize Firebase services
let app = null;
let db = null;
let storage = null;
let tradesCol = null;

// Create auth instance
export let auth = null;

export function initFirebase(customConfig = null) {
  try {
    // Use custom config if provided, otherwise use default config
    const config = customConfig || firebaseConfig;
    app = initializeApp(config);
    // Initialize and export auth
    auth = getAuth(app);
    // Initialize other Firebase services
    db = getFirestore(app);
    storage = getStorage(app);
    tradesCol = collection(db, 'trades');
    console.log('Firebase initialized successfully');
    return true;
  } catch (e) {
    console.warn('Firebase init failed', e);
    app = null;
    auth = null;
    db = null;
    storage = null;
    tradesCol = null;
    return false;
  }
}

// Function to clear all trades from Firestore
export async function clearAllTrades() {
  if (!db) return;
  const tradesRef = collection(db, 'trades');
  const snapshot = await getDocs(tradesRef);
  
  // Delete each document
  const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);
}

function localGetTrades() {
  const raw = localStorage.getItem('trades')
  if (!raw) {
    const sample = [
      {
        id: 't1',
        date: new Date().toISOString(),
        instrument: 'AAPL',
        entry: 150,
        exit: 155,
        size: 10,
        pnl: 50,
        direction: 'long',
        strategy: 'Breakout',
        remarks: 'Good setup',
      },
    ]
    localStorage.setItem('trades', JSON.stringify(sample))
    return sample
  }
  return JSON.parse(raw)
}

async function uploadScreenshot(base64String, tradeId, index) {
  if (!storage) return null
  try {
    const imageRef = ref(storage, `trades/${tradeId}/screenshot-${index}.jpg`)
    await uploadString(imageRef, base64String, 'data_url')
    return await getDownloadURL(imageRef)
  } catch (error) {
    console.error('Error uploading screenshot:', error)
    return null
  }
}

// Clean object by removing undefined/null values and converting empty arrays to null
function cleanObjectForFirestore(obj) {
  const cleaned = {}
  Object.entries(obj).forEach(([key, value]) => {
    // Skip undefined values
    if (value === undefined) return
    
    // Convert empty arrays to null
    if (Array.isArray(value) && value.length === 0) {
      cleaned[key] = null
      return
    }
    
    // Keep non-null values
    if (value !== null) {
      cleaned[key] = value
    }
  })
  return cleaned
}

export async function addTrade(trade) {
  if (tradesCol) {
    try {
      // Clean the trade object before sending to Firebase
      const cleanedTrade = cleanObjectForFirestore({
        ...trade,
        timestamp: new Date().toISOString(),
        // Ensure tags is always an array
        tags: Array.isArray(trade.tags) ? trade.tags : [],
        // Convert numbers to ensure they're not undefined
        pnl: parseFloat(trade.pnl) || 0,
        entry: parseFloat(trade.entry) || 0,
        exit: parseFloat(trade.exit) || 0,
        size: parseFloat(trade.size) || 0,
        stopLoss: parseFloat(trade.stopLoss) || 0,
        takeProfit: parseFloat(trade.takeProfit) || 0,
        riskAmount: parseFloat(trade.riskAmount) || 0,
      })

      const docRef = await addDoc(tradesCol, cleanedTrade)
      
      // If there are screenshots, upload them and get URLs
      const screenshotUrls = []
      if (trade.screenshots && trade.screenshots.length > 0) {
        for (let i = 0; i < trade.screenshots.length; i++) {
          const url = await uploadScreenshot(trade.screenshots[i], docRef.id, i)
          if (url) screenshotUrls.push(url)
        }
        
        // Update the trade document with the screenshot URLs
        if (screenshotUrls.length > 0) {
          const tradeRef = doc(db, 'trades', docRef.id)
          await updateDoc(tradeRef, { screenshotUrls })
        }
      }
      
      return { id: docRef.id, ...trade, screenshotUrls }
    } catch (error) {
      console.error('Error adding trade:', error)
      throw error
    }
  } else {
    const trades = localGetTrades()
    const id = 'local-' + Date.now()
    const t = { id, ...trade }
    trades.unshift(t)
    localStorage.setItem('trades', JSON.stringify(trades))
    return t
  }
}

export function subscribeTrades(setter) {
  if (tradesCol && db) {
    const q = query(tradesCol, orderBy('date', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const arr = []
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }))
      setter(arr)
    })
    return unsub
  } else {
    // local fallback
    const t = localGetTrades()
    setter(t)
    // no real subscription
    return null
  }
}

export async function fetchTrades() {
  if (tradesCol && db) {
    const q = query(tradesCol, orderBy('date', 'desc'))
    const snap = await getDocs(q)
    const arr = []
    snap.forEach((d) => arr.push({ id: d.id, ...d.data() }))
    return arr
  } else {
    return localGetTrades()
  }
}
