import { Capacitor } from '@capacitor/core';
import { createWebDatabase, readLegacySnapshot } from './web';
import { createSqliteDatabase } from './sqlite';
import { openNativeSqlite } from './native';

export const db = Capacitor.isNativePlatform()
  ? createSqliteDatabase(openNativeSqlite, readLegacySnapshot)
  : createWebDatabase();
export const storageKind = db.kind;
export const initializeStorage = () => db.initialize();
