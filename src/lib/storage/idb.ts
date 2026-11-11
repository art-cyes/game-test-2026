/**
 * IndexedDB 存取工具
 *
 * 用途：
 *   - 存放題庫（題目數量可能很多）
 *   - 存放老師上傳的圖片 Blob（localStorage 容量不足）
 *
 * 提供簡單的 key-value 介面，底層用一個 object store。
 */

const DB_NAME = 'pixel-heroes'
const DB_VERSION = 1
const STORE = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const request = fn(transaction.objectStore(STORE))
        request.onsuccess = () => resolve(request.result as T)
        request.onerror = () => reject(request.error)
      }),
  )
}

export function idbGet<T>(key: string): Promise<T | undefined> {
  return tx<T | undefined>('readonly', (store) => store.get(key))
}

export function idbSet<T>(key: string, value: T): Promise<void> {
  return tx<void>('readwrite', (store) => store.put(value, key))
}

export function idbDelete(key: string): Promise<void> {
  return tx<void>('readwrite', (store) => store.delete(key))
}

export function idbKeys(): Promise<IDBValidKey[]> {
  return tx<IDBValidKey[]>('readonly', (store) => store.getAllKeys())
}

/** 產生一個圖片的儲存 key */
export function imageKey(id: string): string {
  return `image:${id}`
}
