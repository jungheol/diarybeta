import * as FileSystem from 'expo-file-system';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { getDBConnection } from '../database/schema';

// 앱 문서 디렉토리 내 이미지 저장소 경로
const IMAGE_DIR = `${FileSystem.documentDirectory}images/`;
const PROFILE_DIR = `${FileSystem.documentDirectory}profiles/`;

// 이미지 디렉토리 초기화
export const initializeImageDirectories = async () => {
  try {
    // 이미지 디렉토리 생성
    const imageDir = await FileSystem.getInfoAsync(IMAGE_DIR);
    if (!imageDir.exists) {
      await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
    }
    
    // 프로필 디렉토리 생성
    const profileDir = await FileSystem.getInfoAsync(PROFILE_DIR);
    if (!profileDir.exists) {
      await FileSystem.makeDirectoryAsync(PROFILE_DIR, { intermediates: true });
    }
    
    return true;
  } catch (error) {
    console.error('Error initializing image directories:', error);
    return false;
  }
};

// 이미지 경로 확인 및 변환 함수
export const getImageUri = async (imagePath: string | null, defaultImage: any = null): Promise<string> => {
  if (!imagePath) return defaultImage;
  
  try {
    // 이미 절대 경로인 경우
    if (imagePath.startsWith('file://')) {
      // 파일 존재 여부 확인
      const fileInfo = await FileSystem.getInfoAsync(imagePath);
      if (fileInfo.exists) {
        return imagePath;
      } else {
        console.warn('Image not found at path:', imagePath);
        return defaultImage;
      }
    } 
    // 상대 경로인 경우
    else {
      // 상대 경로에 따라 적절한 base 디렉토리 선택
      let baseDir = FileSystem.documentDirectory;
      if (imagePath.startsWith('images/')) {
        baseDir = FileSystem.documentDirectory;
      } else if (imagePath.startsWith('profiles/')) {
        baseDir = FileSystem.documentDirectory;
      }
      
      const absolutePath = `${baseDir}${imagePath}`;
      const fileInfo = await FileSystem.getInfoAsync(absolutePath);
      
      if (fileInfo.exists) {
        return absolutePath;
      } else {
        console.warn('Image not found at converted path:', absolutePath);
        return defaultImage;
      }
    }
  } catch (error) {
    console.error('Error processing image path:', error);
    return defaultImage;
  }
};

// 이미지 저장 함수 (상대 경로 반환)
export const saveImage = async (imageUri: string, directory: 'profiles' | 'images', filename?: string): Promise<string> => {
  try {
    // 적절한 디렉토리 선택
    const destDir = directory === 'profiles' ? PROFILE_DIR : IMAGE_DIR;
    
    // 파일명이 제공되지 않은 경우 고유한 파일명 생성
    const finalFilename = filename || `${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
    
    // 대상 경로
    const destUri = `${destDir}${finalFilename}`;
    
    // 이미지 복사
    await FileSystem.copyAsync({
      from: imageUri,
      to: destUri
    });
    
    // 데이터베이스에 저장할 상대 경로 반환
    return `${directory}/${finalFilename}`;
  } catch (error) {
    console.error('Error saving image:', error);
    throw error;
  }
};

// 앱 업데이트 후 이미지 경로 마이그레이션
export const checkAndMigrateImages = async () => {
  try {
    // 앱 버전 확인
    const currentVersion = Application.nativeApplicationVersion || '1.0.0';
    const lastVersion = await AsyncStorage.getItem('app_version');
    
    // 버전이 다르면 마이그레이션 실행
    if (lastVersion !== currentVersion) {
      console.log(`App updated from ${lastVersion || 'unknown'} to ${currentVersion}, checking images...`);
      
      // 디렉토리 초기화
      await initializeImageDirectories();
      
      // 이미지 마이그레이션 실행
      const migrationResult = await migrateImages();
      
      // 현재 버전 저장
      await AsyncStorage.setItem('app_version', currentVersion);
      
      return { success: true, message: 'No migration needed' };
    }
    
    return { success: true, message: 'No migration needed' };
  } catch (err) {
    const error = err as Error;
    console.error('Error in migration check:', error);
    return { success: false, message: error.message };
  }
};

// 이미지 마이그레이션 실행 함수
const migrateImages = async () => {
  try {
    const db = getDBConnection();
    let migratedCount = 0;
    
    // 1. 프로필 이미지 마이그레이션
    const profiles = await db.getAllAsync<{ id: number, photoUrl: string }>(
      'SELECT id, photo_url as photoUrl FROM child WHERE photo_url IS NOT NULL'
    );
    
    for (const profile of profiles) {
      if (!profile.photoUrl) continue;
      
      // 캐시 디렉토리 경로를 사용하는 경우만 마이그레이션
      if (profile.photoUrl.startsWith('file://') && profile.photoUrl.includes('/cache/')) {
        try {
          // 파일이 존재하는지 확인
          const fileInfo = await FileSystem.getInfoAsync(profile.photoUrl);
          
          if (fileInfo.exists) {
            // 새 위치에 이미지 저장
            const fileName = `profile_${profile.id}_${Date.now()}.jpg`;
            const newRelativePath = await saveImage(profile.photoUrl, 'profiles', fileName);
            
            // DB 업데이트
            await db.runAsync(
              'UPDATE child SET photo_url = ? WHERE id = ?',
              [newRelativePath, profile.id]
            );
            
            migratedCount++;
          }
        } catch (err) {
          const error = err as Error;
          console.warn(`Failed to migrate profile image for ID ${profile.id}:`, error);
        }
      }
    }
    
    // 2. 다이어리 이미지 마이그레이션
    const diaryImages = await db.getAllAsync<{ id: number, imageUri: string }>(
      'SELECT id, image_uri as imageUri FROM diary_picture WHERE image_uri IS NOT NULL'
    );
    
    for (const image of diaryImages) {
      if (!image.imageUri) continue;
      
      // 캐시 디렉토리 경로를 사용하는 경우만 마이그레이션
      if (image.imageUri.startsWith('file://') && image.imageUri.includes('/cache/')) {
        try {
          // 파일이 존재하는지 확인
          const fileInfo = await FileSystem.getInfoAsync(image.imageUri);
          
          if (fileInfo.exists) {
            // 새 위치에 이미지 저장
            const fileName = `diary_${image.id}_${Date.now()}.jpg`;
            const newRelativePath = await saveImage(image.imageUri, 'images', fileName);
            
            // DB 업데이트
            await db.runAsync(
              'UPDATE diary_picture SET image_uri = ? WHERE id = ?',
              [newRelativePath, image.id]
            );
            
            migratedCount++;
          }
        } catch (err) {
          const error = err as Error;
          console.warn(`Failed to migrate diary image for ID ${image.id}:`, error);
        }
      }
    }
    
    console.log(`Migration completed: ${migratedCount} images migrated`);
    return { success: true, message: `${migratedCount} images migrated` };
    
  } catch (err) {
    const error = err as Error;
    console.error('Error during image migration:', error);
    return { success: false, message: error.message };
  }
};