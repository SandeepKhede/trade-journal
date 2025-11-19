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
  uploadBytes,
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

// Compress image to reduce base64 size (stays within Firestore 1MB limit)
// Returns compressed base64 string
function compressImage(base64String, maxWidth = 1200, quality = 0.7, depth = 0) {
  // Prevent infinite recursion
  if (depth > 5) {
    console.warn('Max compression depth reached, using current result')
    return Promise.resolve(base64String)
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      // Calculate new dimensions
      let width = img.width
      let height = img.height
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }
      
      // Create canvas and compress
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      
      // Convert to base64 with compression
      const compressedBase64 = canvas.toDataURL('image/jpeg', quality)
      
      // Check size (base64 is ~33% larger than binary)
      const sizeInBytes = (compressedBase64.length * 3) / 4
      const sizeInMB = sizeInBytes / (1024 * 1024)
      
      if (sizeInMB > 0.9 && depth < 5) {
        // If still too large, compress more aggressively
        if (quality > 0.5) {
          resolve(compressImage(base64String, maxWidth * 0.8, quality - 0.1, depth + 1))
        } else if (maxWidth > 400) {
          // Last resort: reduce dimensions more
          resolve(compressImage(base64String, maxWidth * 0.7, 0.5, depth + 1))
        } else {
          // Can't compress more, return what we have
          console.warn(`Image still large (${sizeInMB.toFixed(2)}MB) after compression`)
          resolve(compressedBase64)
        }
      } else {
        resolve(compressedBase64)
      }
    }
    img.onerror = (error) => {
      console.error('Error loading image for compression:', error)
      reject(new Error('Failed to load image for compression'))
    }
    img.src = base64String
  })
}

// Calculate base64 string size in MB
function getBase64Size(base64String) {
  // Remove data URL prefix if present
  const base64Data = base64String.includes(',') 
    ? base64String.split(',')[1] 
    : base64String
  // Base64 is ~33% larger than binary, so we multiply by 3/4
  const sizeInBytes = (base64Data.length * 3) / 4
  return sizeInBytes / (1024 * 1024) // Convert to MB
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
      // Process and compress screenshots if present
      let processedScreenshots = []
      if (trade.screenshots && trade.screenshots.length > 0) {
        for (let i = 0; i < trade.screenshots.length; i++) {
          try {
            const compressed = await compressImage(trade.screenshots[i])
            const size = getBase64Size(compressed)
            
            if (size > 0.9) {
              console.warn(`Screenshot ${i + 1} is still large (${size.toFixed(2)}MB) after compression`)
            }
            
            processedScreenshots.push(compressed)
          } catch (error) {
            console.error(`Error compressing screenshot ${i + 1}:`, error)
            // Use original if compression fails
            processedScreenshots.push(trade.screenshots[i])
          }
        }
      }
      
      // Calculate total size of screenshots
      const totalScreenshotSize = processedScreenshots.reduce((sum, img) => sum + getBase64Size(img), 0)
      const otherDataSize = 0.1 // Estimate for other trade data (rough estimate)
      const totalSize = totalScreenshotSize + otherDataSize
      
      if (totalSize > 1) {
        throw new Error(
          `Trade data too large (${totalSize.toFixed(2)}MB). ` +
          `Firestore limit is 1MB. Please reduce number of screenshots or image quality.`
        )
      }
      
      // Clean the trade object before sending to Firebase
      const cleanedTrade = cleanObjectForFirestore({
        ...trade,
        timestamp: new Date().toISOString(),
        // Store screenshots as base64 in Firestore (not in Storage)
        screenshots: processedScreenshots.length > 0 ? processedScreenshots : null,
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
      
      return { id: docRef.id, ...trade, screenshots: processedScreenshots }
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

export async function updateTrade(tradeId, updates) {
  if (tradesCol && db && tradeId) {
    try {
      const tradeRef = doc(db, 'trades', tradeId)
      
      // Handle screenshots if provided - store as base64 in Firestore
      if (updates.screenshots && Array.isArray(updates.screenshots) && updates.screenshots.length > 0) {
        const allScreenshots = []
        const existingScreenshots = updates.existingScreenshotUrls || []
        
        // Keep existing base64 screenshots (those that are data URLs)
        existingScreenshots.forEach(url => {
          if (url.startsWith('data:')) {
            allScreenshots.push(url)
          }
        })
        
        // Process and compress new screenshots
        for (let i = 0; i < updates.screenshots.length; i++) {
          const screenshot = updates.screenshots[i]
          
          // If it's already a base64 string, use it
          if (typeof screenshot === 'string' && screenshot.startsWith('data:')) {
            try {
              const compressed = await compressImage(screenshot)
              allScreenshots.push(compressed)
            } catch (error) {
              console.error(`Error compressing screenshot ${i + 1}:`, error)
              allScreenshots.push(screenshot) // Use original if compression fails
            }
          } else if (typeof screenshot === 'string' && screenshot.startsWith('http')) {
            // If it's a URL from old Storage, we can't keep it in base64 format
            // Skip it or convert it (but we don't have the image data)
            console.warn('Cannot convert Storage URL to base64, skipping:', screenshot)
          }
        }
        
        // Calculate total size
        const totalScreenshotSize = allScreenshots.reduce((sum, img) => sum + getBase64Size(img), 0)
        const otherDataSize = 0.1 // Estimate for other trade data
        
        if (totalScreenshotSize + otherDataSize > 1) {
          throw new Error(
            `Trade data too large (${(totalScreenshotSize + otherDataSize).toFixed(2)}MB). ` +
            `Firestore limit is 1MB. Please reduce number of screenshots.`
          )
        }
        
        // Remove screenshotUrls from updates and add processed screenshots
        const { screenshots, existingScreenshotUrls, ...restUpdates } = updates
        updates = { ...restUpdates, screenshots: allScreenshots.length > 0 ? allScreenshots : null }
      }
      
      // Clean the updates object
      const cleanedUpdates = cleanObjectForFirestore(updates)
      
      // Update the trade document
      await updateDoc(tradeRef, cleanedUpdates)
      
      return { id: tradeId, ...updates }
    } catch (error) {
      console.error('Error updating trade:', error)
      throw error
    }
  } else if (tradeId) {
    // Local storage fallback
    const trades = localGetTrades()
    const index = trades.findIndex(t => t.id === tradeId)
    if (index !== -1) {
      trades[index] = { ...trades[index], ...updates }
      localStorage.setItem('trades', JSON.stringify(trades))
      return trades[index]
    }
    throw new Error('Trade not found')
  } else {
    throw new Error('Trade ID is required')
  }
}