import * as FileSystem from 'expo-file-system';

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

    const pathsToTry = [
        imagePath, // 원래 경로
        imagePath.startsWith('file://') ? imagePath : `file://${imagePath}`, // file:// 접두사 추가
        imagePath.startsWith('/') ? `file://${imagePath}` : imagePath, // 절대 경로인 경우 file:// 추가
        `${FileSystem.documentDirectory}${imagePath.replace(/^\//, '')}`, // 문서 디렉토리 기준
        `${FileSystem.cacheDirectory}${imagePath.replace(/^\//, '')}` // 캐시 디렉토리 기준
      ];
      
      // 모든 가능한 경로 시도
      for (const path of pathsToTry) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(path);
          if (fileInfo.exists) {
            return path;
          }
        } catch (e) {
          // 개별 경로 시도 실패는 무시
        }
      }
      
      return defaultImage;
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