import * as SQLite from 'expo-sqlite';
import { Child } from '../types';

// Database connection
export const getDBConnection = () => {
  return SQLite.openDatabaseSync('ParentingDiary.db');
};

// Create tables
export const createTables = async (db: SQLite.SQLiteDatabase) => {
  // const childTableQuery = `
  //   CREATE TABLE IF NOT EXISTS child (
  //     id INTEGER PRIMARY KEY AUTOINCREMENT,
  //     first_name TEXT NOT NULL,
  //     last_name TEXT NOT NULL,
  //     birth_date TEXT NOT NULL,
  //     photo_url TEXT,
  //     created_at TEXT DEFAULT CURRENT_TIMESTAMP
  //   )
  // `;

  // const diaryEntryQuery = `
  //   CREATE TABLE IF NOT EXISTS diary_entry (
  //     id INTEGER PRIMARY KEY AUTOINCREMENT,
  //     child_id INTEGER,
  //     content TEXT NOT NULL,
  //     created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  //     FOREIGN KEY (child_id) REFERENCES child (id)
  //   )
  // `;

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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (child_id) REFERENCES child (id)
    );
  `);
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
};

// Insert child
export const insertChild = async (
  db: SQLite.SQLiteDatabase,
  child: Omit<Child, 'id' | 'createdAt'>
): Promise<number> => {
  const { firstName, lastName, birthDate, photoUrl } = child;

  try {
    const result = await db.runAsync(
      `INSERT INTO child (first_name, last_name, birth_date, photo_url)
        VALUES (?, ?, ?, ?)`,
      [firstName, lastName, birthDate, photoUrl || null]
    );
    
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Error inserting child:', error);
    throw error;
  }
};