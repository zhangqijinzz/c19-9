import type { LayoutDocument } from './types';

export interface DocumentStorageService {
  /** 读取原始存档内容；结构是否有效交给迁移层判断，读取/解析失败时抛错 */
  read(): Promise<unknown | null>;
  write(document: LayoutDocument): Promise<void>;
  clear(): Promise<void>;
}

const STORAGE_KEY = 'exposketch.document.v1';

const canUseIndexedDb = () => typeof indexedDB !== 'undefined';

export class BrowserStorageService implements DocumentStorageService {
  async read(): Promise<unknown | null> {
    if (!canUseIndexedDb()) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    }
    return this.withDatabase((store) => new Promise<unknown | null>((resolve, reject) => {
      const request = store.get(STORAGE_KEY);
      request.onsuccess = () => resolve((request.result as unknown | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('读取布局失败'));
    }));
  }

  async write(document: LayoutDocument): Promise<void> {
    if (!canUseIndexedDb()) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
      return;
    }
    await this.withDatabase((store) => new Promise<void>((resolve, reject) => {
      const request = store.put(document, STORAGE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('保存布局失败'));
    }));
  }

  async clear(): Promise<void> {
    if (!canUseIndexedDb()) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    await this.withDatabase((store) => new Promise<void>((resolve, reject) => {
      const request = store.delete(STORAGE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('清理本地布局失败'));
    }));
  }

  private withDatabase<T>(run: (store: IDBObjectStore) => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('exposketch-db', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('documents');
      request.onerror = () => reject(request.error ?? new Error('打开本地数据库失败'));
      request.onsuccess = () => {
        const transaction = request.result.transaction('documents', 'readwrite');
        run(transaction.objectStore('documents')).then(resolve).catch(reject);
        transaction.oncomplete = () => request.result.close();
      };
    });
  }
}
