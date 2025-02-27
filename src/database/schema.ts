import * as SQLite from 'expo-sqlite';
import { Child } from '../types';
import { initializeImageDirectories } from '../services/ImageService';

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
    await createTables(db);
    
    return true;
  } catch (error) {
    console.error('Error initializing app:', error);
    return false;
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