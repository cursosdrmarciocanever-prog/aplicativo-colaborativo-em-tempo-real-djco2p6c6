// src/lib/offline/db.ts
// Armazenamento offline local com IndexedDB nativo (sem dependências externas)

export interface OfflineQueueItem {
  id: string // UUID gerado no cliente
  collection: string
  action: 'create' | 'update' | 'delete'
  data: Record<string, unknown>
  createdAt: number
  attempts: number
}

const DB_NAME = 'diario_sarah_offline'
const DB_VERSION = 1
const QUEUE_STORE = 'queue'
const CACHE_STORE = 'cache'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB não suportado'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Enfileira uma mutação para envio posterior
 */
export async function enqueueMutation(item: OfflineQueueItem): Promise<void> {
  try {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite')
      const store = tx.objectStore(QUEUE_STORE)
      const req = store.put(item)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('Falha ao salvar offline:', err)
  }
}

/**
 * Retorna todos os itens pendentes na fila
 */
export async function getPendingMutations(): Promise<OfflineQueueItem[]> {
  try {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readonly')
      const store = tx.objectStore(QUEUE_STORE)
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
  } catch {
    return []
  }
}

/**
 * Remove um item da fila após envio bem-sucedido
 */
export async function dequeueMutation(id: string): Promise<void> {
  try {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite')
      const store = tx.objectStore(QUEUE_STORE)
      const req = store.delete(id)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('Falha ao desinfileirar:', err)
  }
}

/**
 * Salva cache de registros
 */
export async function setCachedData(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite')
      const store = tx.objectStore(CACHE_STORE)
      const req = store.put({ key, value, timestamp: Date.now() })
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    /* intentionally ignored */
  }
}

/**
 * Lê cache de registros
 */
export async function getCachedData<T = unknown>(key: string): Promise<T | null> {
  try {
    const db = await openDatabase()
    return new Promise((resolve) => {
      const tx = db.transaction(CACHE_STORE, 'readonly')
      const store = tx.objectStore(CACHE_STORE)
      const req = store.get(key)
      req.onsuccess = () => {
        if (req.result && req.result.value) {
          resolve(req.result.value as T)
        } else {
          resolve(null)
        }
      }
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}
