import { createStarterDocument } from './domain';
import { restoreDocument } from './documentRestore';
import type { DocumentStorageService } from './storageService';
import type { DocumentReport, LayoutDocument } from './types';

export interface LoadResult {
  document: LayoutDocument;
  report: DocumentReport;
}

export interface LayoutRepository {
  load(): Promise<LoadResult>;
  save(document: LayoutDocument): Promise<void>;
}

const CLEAN_REPORT: DocumentReport = { status: 'clean', issues: [] };

export class LocalLayoutRepository implements LayoutRepository {
  constructor(private readonly storage: DocumentStorageService) {}

  async load(): Promise<LoadResult> {
    let saved: unknown = null;
    try {
      saved = await this.storage.read();
    } catch (error) {
      const message = error instanceof SyntaxError
        ? '存档数据损坏，无法解析（不是有效的 JSON）'
        : `读取本地存档失败：${error instanceof Error ? error.message : '未知错误'}`;
      return { document: createStarterDocument(), report: { status: 'fatal', issues: [{ path: 'storage', message }] } };
    }
    if (saved === null || saved === undefined) return { document: createStarterDocument(), report: CLEAN_REPORT };
    const { document, report } = restoreDocument(saved);
    return { document: document ?? createStarterDocument(), report };
  }

  async save(document: LayoutDocument): Promise<void> {
    await this.storage.write(document);
  }
}
