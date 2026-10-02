import { createStarterDocument } from './domain';
import { migrateDocument } from './documentMigration';
import type { DocumentStorageService } from './storageService';
import type { LayoutDocument, LoadOutcome } from './types';

export interface LayoutRepository {
  load(): Promise<LoadOutcome>;
  save(document: LayoutDocument): Promise<void>;
  clear(): Promise<void>;
}

export class LocalLayoutRepository implements LayoutRepository {
  constructor(private readonly storage: DocumentStorageService) {}

  async load(): Promise<LoadOutcome> {
    let raw: unknown = null;
    try {
      raw = await this.storage.read();
    } catch {
      return { status: 'failed', error: '无法读取本地存档（本地数据库或浏览器存储不可用）。' };
    }

    if (raw === null || raw === undefined) {
      return { status: 'ok', document: createStarterDocument() };
    }

    try {
      const result = migrateDocument(raw);
      if (!result.document || result.fatal) {
        return { status: 'failed', error: result.fatal ?? '存档无法识别。', issues: result.issues };
      }
      if (result.issues.length > 0) {
        return { status: 'repaired', document: result.document, issues: result.issues };
      }
      return { status: 'ok', document: result.document };
    } catch (cause) {
      return { status: 'failed', error: cause instanceof Error ? cause.message : '解析存档时发生未知错误。' };
    }
  }

  async save(document: LayoutDocument): Promise<void> {
    await this.storage.write(document);
  }

  async clear(): Promise<void> {
    await this.storage.clear();
  }
}
