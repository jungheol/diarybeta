import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { CloudStorage, CloudStorageProvider, useIsCloudAvailable } from 'react-native-cloud-storage';
import { Alert, Platform } from 'react-native';
import { getDBConnection } from '../database/schema';
import { zip, unzip } from 'react-native-zip-archive';

const BACKUP_FILENAME = 'diary_app_backup.zip';
const DB_NAME = 'diaryapp.db';
const BACKUP_FOLDER = `${FileSystem.documentDirectory}backup/`;
const IMAGES_FOLDER = `${FileSystem.cacheDirectory}`;
const DB_LOCATION = `${FileSystem.documentDirectory}SQLite/${DB_NAME}`;

// 백업에 포함될 파일 경로 확인을 위한 헬퍼 함수
const getAllImagePaths = async (): Promise<string[]> => {
  try {
    const db = getDBConnection();
    
    // 프로필 이미지 가져오기
    const profileImages = await db.getAllAsync<{ photoUrl: string }>(
      `SELECT photo_url as photoUrl FROM child WHERE photo_url IS NOT NULL`
    );
    
    // 다이어리 이미지 가져오기
    const diaryImages = await db.getAllAsync<{ imageUri: string }>(
      `SELECT image_uri as imageUri FROM diary_picture WHERE image_uri IS NOT NULL`
    );
    
    // 모든 이미지 경로 모으기
    const imagePaths = [
      ...profileImages.map(item => item.photoUrl),
      ...diaryImages.map(item => item.imageUri)
    ].filter(path => path && path.startsWith('file://'));
    
    return imagePaths;
  } catch (error) {
    console.error('Error getting image paths:', error);
    return [];
  }
};

// 백업 폴더 생성
const createBackupFolder = async (): Promise<void> => {
  const dirInfo = await FileSystem.getInfoAsync(BACKUP_FOLDER);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(BACKUP_FOLDER, { intermediates: true });
  }
};

// 로컬 백업 생성
export const createBackup = async (): Promise<string> => {
  try {
    await createBackupFolder();
    
    // 1. 데이터베이스 백업
    const dbBackupPath = `${BACKUP_FOLDER}${DB_NAME}`;
    await FileSystem.copyAsync({
      from: DB_LOCATION,
      to: dbBackupPath
    });
    
    // 2. 이미지 파일 경로 가져오기
    const imagePaths = await getAllImagePaths();
    
    // 3. 이미지 파일 복사
    const imagesFolderPath = `${BACKUP_FOLDER}images/`;
    await FileSystem.makeDirectoryAsync(imagesFolderPath, { intermediates: true });
    
    // 4. 이미지 경로 매핑 정보 저장 (복원 시 사용)
    const imageMapping: Record<string, string> = {};
    
    for (let i = 0; i < imagePaths.length; i++) {
      const originalPath = imagePaths[i];
      const filename = originalPath.split('/').pop();
      const destPath = `${imagesFolderPath}${filename}`;
      
      await FileSystem.copyAsync({
        from: originalPath,
        to: destPath
      });
      
      // 원본 경로와 백업 내 상대 경로 매핑
      imageMapping[originalPath] = `images/${filename}`;
    }
    
    // 매핑 정보를 JSON 파일로 저장
    await FileSystem.writeAsStringAsync(
      `${BACKUP_FOLDER}image_mapping.json`,
      JSON.stringify(imageMapping)
    );
    
    // 5. 백업 폴더 압축
    const zipPath = `${FileSystem.documentDirectory}${BACKUP_FILENAME}`;
    await zip(BACKUP_FOLDER, zipPath);
    
    // 6. 백업 폴더 삭제 (압축 후)
    await FileSystem.deleteAsync(BACKUP_FOLDER, { idempotent: true });
    
    return zipPath;
  } catch (error) {
    console.error('Error creating backup:', error);
    throw new Error('백업 생성 중 오류가 발생했습니다.');
  }
};

// iCloud에 백업 업로드
export const uploadBackupToiCloud = async (): Promise<void> => {
  try {
    // 1. 로컬 백업 생성
    console.log('시작: 로컬 백업 생성');
    const backupPath = await createBackup();
    console.log('완료: 로컬 백업 생성', backupPath);
    
    // 2. 백업 파일 읽기
    console.log('시작: 백업 파일 읽기');
    const backupData = await FileSystem.readAsStringAsync(backupPath, { encoding: 'base64' });
    console.log('완료: 백업 파일 읽기, 크기:', backupData.length);
    
    // 3. iCloud 사용 가능 여부 확인
    console.log('시작: iCloud 상태 확인');
    const isCloudAvailable = await CloudStorage.isCloudAvailable();
    console.log('완료: iCloud 상태:', isCloudAvailable);
    
    if (!isCloudAvailable) {
      throw new Error('iCloud를 사용할 수 없습니다. Apple ID로 로그인되어 있고, iCloud Drive가 활성화되어 있는지 확인하세요.');
    }
    
    // 4. iCloud에 업로드
    console.log('시작: iCloud 업로드');
    await CloudStorage.writeFile(BACKUP_FILENAME, backupData);
    console.log('완료: iCloud 업로드');
    
    // 5. 임시 백업 파일 삭제
    console.log('시작: 임시 파일 삭제');
    await FileSystem.deleteAsync(backupPath, { idempotent: true });
    console.log('완료: 임시 파일 삭제');
    
    Alert.alert('백업 완료', 'iCloud에 데이터가 성공적으로 백업되었습니다.');
  } catch (error) {
    console.error('Error uploading to iCloud:', error);
    // 오류 세부 정보 추출
    let errorMessage = '데이터를 iCloud에 업로드하는 중 오류가 발생했습니다.';
    let errorDetails = '';
    
    if (error instanceof Error) {
      errorDetails += `\n\n에러 유형: ${error.constructor.name}`;
      errorDetails += `\n메시지: ${error.message}`;
      
      // 코드와 도메인 정보 (iOS 네이티브 에러에 존재할 수 있음)
      if ('code' in error) {
        errorDetails += `\n코드: ${(error as any).code}`;
      }
      if ('domain' in error) {
        errorDetails += `\n도메인: ${(error as any).domain}`;
      }
      
      // CloudStorage 관련 추가 정보
      if (error.message.includes('CloudKit') || error.message.includes('iCloud')) {
        errorDetails += `\n\niCloud 관련 오류입니다. Apple ID 로그인 상태와 iCloud Drive 설정을 확인하세요.`;
      }
      
      // 스택 트레이스 로깅 (콘솔에만)
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
    } else {
      errorDetails += `\n\n비정형 오류: ${JSON.stringify(error)}`;
    }
    
    // 확인 가능한 iCloud 상태 정보 추가
    try {
      const isAvailable = await CloudStorage.isCloudAvailable();
      errorDetails += `\n\niCloud 사용 가능 상태: ${isAvailable ? '사용 가능' : '사용 불가'}`;
    } catch (statusError) {
      errorDetails += `\n\niCloud 상태 확인 실패: ${(statusError as Error).message}`;
    }
    
    Alert.alert(
      '백업 실패', 
      errorMessage + errorDetails,
      [
        { text: '확인' },
        { 
          text: '오류 정보 복사',
          onPress: async () => {
            try {
              await Clipboard.setStringAsync(errorDetails);
              Alert.alert('복사됨', '오류 정보가 클립보드에 복사되었습니다.');
            } catch (e) {
              console.error('클립보드 복사 실패:', e);
            }
          } 
        }
      ]
    );
  }
};

// iCloud에서 백업 복원
export const restoreFromiCloud = async (): Promise<boolean> => {
  try {
    // 1. iCloud에서 백업 데이터 가져오기
    const backupData = await CloudStorage.readFile(BACKUP_FILENAME);
    
    if (!backupData) {
      Alert.alert('복원 실패', 'iCloud에서 백업을 찾을 수 없습니다.');
      return false;
    }
    
    // 2. 백업 데이터를 임시 파일로 저장
    const tempZipPath = `${FileSystem.documentDirectory}${BACKUP_FILENAME}`;
    await FileSystem.writeAsStringAsync(tempZipPath, backupData, { encoding: 'base64' });
    
    // 3. 압축 해제
    const extractPath = `${FileSystem.documentDirectory}extracted_backup/`;
    await unzip(tempZipPath, extractPath);
    
    // 4. DB 복원 처리
    const extractedDB = `${extractPath}${DB_NAME}`;
    
    // 4.1. 기존 DB가 있다면 닫기 처리
    // 여기서는 앱을 재시작해야 하므로 사용자에게 안내가 필요할 수 있음
    
    // 4.2. 기존 DB 파일 교체
    await FileSystem.deleteAsync(DB_LOCATION, { idempotent: true });
    await FileSystem.copyAsync({
      from: extractedDB,
      to: DB_LOCATION
    });
    
    // 5. 이미지 복원 처리
    const imageMappingPath = `${extractPath}image_mapping.json`;
    const imageMappingJson = await FileSystem.readAsStringAsync(imageMappingPath);
    const imageMapping = JSON.parse(imageMappingJson);
    
    // 이미지 디렉토리 생성
    await FileSystem.makeDirectoryAsync(IMAGES_FOLDER, { intermediates: true });
    
    // 이미지 파일 복사
    for (const [originalPath, relativePath] of Object.entries(imageMapping)) {
      const sourceImagePath = `${extractPath}${relativePath}`;
      
      // 원본 경로로 복사
      await FileSystem.copyAsync({
        from: sourceImagePath,
        to: originalPath
      });
    }
    
    // 6. 임시 파일 정리
    await FileSystem.deleteAsync(tempZipPath, { idempotent: true });
    await FileSystem.deleteAsync(extractPath, { idempotent: true });
    
    Alert.alert('복원 완료', '데이터가 성공적으로 복원되었습니다. 앱을 재시작해주세요.');
    return true;
  } catch (error) {
    console.error('Error restoring from iCloud:', error);
    Alert.alert('복원 실패', '백업 데이터를 복원하는 중 오류가 발생했습니다.');
    return false;
  }
};

// 파일로 백업 내보내기 (iCloud 사용이 불가능한 경우 대안)
export const exportBackupFile = async (): Promise<void> => {
  try {
    // 1. 로컬 백업 생성
    const backupPath = await createBackup();
    
    // 2. 파일 공유 다이얼로그 열기
    await Sharing.shareAsync(backupPath, {
      mimeType: 'application/zip',
      dialogTitle: '백업 파일 저장'
    });
    
    // 3. 임시 백업 파일 삭제
    await FileSystem.deleteAsync(backupPath, { idempotent: true });
  } catch (error) {
    console.error('Error exporting backup file:', error);
    Alert.alert('내보내기 실패', '백업 파일을 내보내는 중 오류가 발생했습니다.');
  }
};

// 파일에서 백업 가져오기 (iCloud 사용이 불가능한 경우 대안)
export const importBackupFile = async (): Promise<boolean> => {
  try {
    // 1. 파일 선택 다이얼로그 열기
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/zip',
      copyToCacheDirectory: true
    });
    
    if (result.canceled) {
      return false;
    }
    
    const backupPath = result.assets[0].uri;
    
    // 2. 압축 해제
    const extractPath = `${FileSystem.documentDirectory}extracted_backup/`;
    await unzip(backupPath, extractPath);
    
    // 3. DB 복원 처리
    const extractedDB = `${extractPath}${DB_NAME}`;
    
    // 3.1. 기존 DB가 있다면 닫기 처리 (앱 재시작 필요)
    
    // 3.2. 기존 DB 파일 교체
    await FileSystem.deleteAsync(DB_LOCATION, { idempotent: true });
    await FileSystem.copyAsync({
      from: extractedDB,
      to: DB_LOCATION
    });
    
    // 4. 이미지 복원 처리
    const imageMappingPath = `${extractPath}image_mapping.json`;
    const imageMappingJson = await FileSystem.readAsStringAsync(imageMappingPath);
    const imageMapping = JSON.parse(imageMappingJson);
    
    // 이미지 디렉토리 생성
    await FileSystem.makeDirectoryAsync(IMAGES_FOLDER, { intermediates: true });
    
    // 이미지 파일 복사
    for (const [originalPath, relativePath] of Object.entries(imageMapping)) {
      const sourceImagePath = `${extractPath}${relativePath}`;
      
      // 원본 경로로 복사
      await FileSystem.copyAsync({
        from: sourceImagePath,
        to: originalPath
      });
    }
    
    // 5. 임시 파일 정리
    await FileSystem.deleteAsync(extractPath, { idempotent: true });
    
    Alert.alert('복원 완료', '데이터가 성공적으로 복원되었습니다. 앱을 재시작해주세요.');
    return true;
  } catch (error) {
    console.error('Error importing backup file:', error);
    Alert.alert('가져오기 실패', '백업 파일을 가져오는 중 오류가 발생했습니다.');
    return false;
  }
};