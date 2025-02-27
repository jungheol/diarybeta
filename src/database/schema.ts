import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Child } from '../types';
import { checkAndMigrateImages, initializeImageDirectories } from '../services/ImageService';

// Database connection
export const getDBConnection = () => {
  return SQLite.openDatabaseSync('ParentingDiary.db');
};

// Create tables
export const createTables = async (db: SQLite.SQLiteDatabase) => {
  try {
    await db.execAsync(`
    CREATE TABLE IF NOT EXISTS child (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      photo_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS diary_entry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER,
      content TEXT NOT NULL,
      bookmark INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (child_id) REFERENCES child (id)
    );
    CREATE TABLE IF NOT EXISTS diary_picture (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      diary_entry_id INTEGER,
      image_uri TEXT NOT NULL,
      image_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (diary_entry_id) REFERENCES diary_entry (id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

    await initializeImageDirectories();
    
    return db;
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
};

export const initializeApp = async () => {
  try {
    // DB 연결 및 테이블 생성
    const db = getDBConnection();
    debugImagePaths();
    await createTables(db);
    
    // 이미지 경로 마이그레이션 확인 및 수행
    const migrationResult = await checkAndMigrateImages();
    
    return true;
  } catch (error) {
    console.error('Error initializing app:', error);
    return false;
  }
};

// Splash 또는 앱 시작 부분에 추가
const debugImagePaths = async () => {
  try {
    const db = getDBConnection();
    
    // 프로필 이미지 경로 확인
    const profiles = await db.getAllAsync<{ id: number, photoUrl: string }>(
      'SELECT id, photo_url as photoUrl FROM child WHERE photo_url IS NOT NULL'
    );
        
    // 다이어리 이미지 경로 확인
    const images = await db.getAllAsync<{ id: number, uri: string }>(
      'SELECT id, image_uri as uri FROM diary_picture WHERE image_uri IS NOT NULL LIMIT 10'
    );
        
    // 각 경로의 파일 존재 여부 확인
    for (const profile of profiles) {
      if (profile.photoUrl) {
        const info = await FileSystem.getInfoAsync(profile.photoUrl);
        console.log(`Profile ${profile.id}: ${profile.photoUrl} exists: ${info.exists}`);
      }
    }
  } catch (error) {
    console.error('Error debugging image paths:', error);
  }
};

// Insert child
export const insertChild = async (
  db: SQLite.SQLiteDatabase,
  child: Omit<Child, 'id' | 'createdAt'>
): Promise<number> => {
  const { firstName, lastName, birthDate, photoUrl, isActive } = child;

  try {
    const result = await db.runAsync(
      `INSERT INTO child (first_name, last_name, birth_date, photo_url, is_active)
        VALUES (?, ?, ?, ?, ?)`,
      [firstName, lastName, birthDate, photoUrl || null, isActive]
    );
    
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Error inserting child:', error);
    throw error;
  }
};