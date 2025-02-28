import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  uploadBackupToiCloud,
  restoreFromiCloud,
  exportBackupFile,
  importBackupFile,
} from '../services/backupService';

const BackupRestoreScreen: React.FC = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<string>('');

  const handleBackup = async () => {
    // iCloud 백업 방식 선택 알림
    if (Platform.OS === 'ios') {
      Alert.alert(
        '백업 방법 선택',
        '백업 방법을 선택해주세요.',
        [
          {
            text: 'iCloud에 백업',
            onPress: () => performiCloudBackup(),
          },
          {
            text: '파일로 내보내기',
            onPress: () => performFileBackup(),
          },
          {
            text: '취소',
            style: 'cancel',
          },
        ],
        { cancelable: true }
      );
    } else {
      // Android는 파일로 내보내기만 지원
      performFileBackup();
    }
  };

  const performiCloudBackup = async () => {
    try {
      setIsLoading(true);
      setLoadingText('iCloud에 백업 중...');
      await uploadBackupToiCloud();
    } catch (error) {
      console.error('Error during iCloud backup:', error);
      Alert.alert('백업 실패', '백업 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setLoadingText('');
    }
  };

  const performFileBackup = async () => {
    try {
      setIsLoading(true);
      setLoadingText('백업 파일 생성 중...');
      await exportBackupFile();
    } catch (error) {
      console.error('Error during file backup:', error);
      Alert.alert('백업 실패', '백업 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setLoadingText('');
    }
  };

  const handleRestore = async () => {
    // 복원 방식 선택 알림
    if (Platform.OS === 'ios') {
      Alert.alert(
        '복원 방법 선택',
        '백업 방법을 선택해주세요.',
        [
          {
            text: 'iCloud에서 복원',
            onPress: () => performiCloudRestore(),
          },
          {
            text: '파일에서 가져오기',
            onPress: () => performFileRestore(),
          },
          {
            text: '취소',
            style: 'cancel',
          },
        ],
        { cancelable: true }
      );
    } else {
      // Android는 파일에서 가져오기만 지원
      performFileRestore();
    }
  };

  const performiCloudRestore = async () => {
    try {
      setIsLoading(true);
      setLoadingText('iCloud에서 복원 중...');
      
      // 복원 전 확인 알림
      Alert.alert(
        '복원 확인',
        '복원을 진행하면 현재 데이터가 모두 삭제되고 백업된 데이터로 대체됩니다. 계속하시겠습니까?',
        [
          {
            text: '취소',
            style: 'cancel',
            onPress: () => {
              setIsLoading(false);
              setLoadingText('');
            },
          },
          {
            text: '계속',
            onPress: async () => {
              const success = await restoreFromiCloud();
              if (success) {
                // 복원 성공 - 앱 재시작 필요
                Alert.alert(
                  '복원 완료',
                  '데이터가 성공적으로 복원되었습니다. 앱을 재시작해주세요.',
                  [{ text: '확인' }]
                );
              }
              setIsLoading(false);
              setLoadingText('');
            },
          },
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error('Error during iCloud restore:', error);
      Alert.alert('복원 실패', '복원 중 오류가 발생했습니다.');
      setIsLoading(false);
      setLoadingText('');
    }
  };

  const performFileRestore = async () => {
    try {
      setIsLoading(true);
      setLoadingText('파일에서 복원 중...');
      
      // 복원 전 확인 알림
      Alert.alert(
        '복원 확인',
        '복원을 진행하면 현재 데이터가 모두 삭제되고 백업된 데이터로 대체됩니다. 계속하시겠습니까?',
        [
          {
            text: '취소',
            style: 'cancel',
            onPress: () => {
              setIsLoading(false);
              setLoadingText('');
            },
          },
          {
            text: '계속',
            onPress: async () => {
              const success = await importBackupFile();
              if (success) {
                // 복원 성공 - 앱 재시작 필요
                Alert.alert(
                  '복원 완료',
                  '데이터가 성공적으로 복원되었습니다. 앱을 재시작해주세요.',
                  [{ text: '확인' }]
                );
              }
              setIsLoading(false);
              setLoadingText('');
            },
          },
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error('Error during file restore:', error);
      Alert.alert('복원 실패', '복원 중 오류가 발생했습니다.');
      setIsLoading(false);
      setLoadingText('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 영역 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>◀</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>백업 및 복원</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>백업</Text>
          <Text style={styles.description}>
            현재 앱의 모든 데이터(다이어리, 이미지, 프로필 정보)를 백업합니다.
            {Platform.OS === 'ios' ? ' iCloud에 백업하거나 파일로 내보낼 수 있습니다.' : ' 백업 파일을 저장할 위치를 선택하세요.'}
          </Text>
          <TouchableOpacity
            style={[styles.button, isLoading && styles.disabledButton]}
            onPress={handleBackup}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>백업하기</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>복원</Text>
          <Text style={styles.description}>
            백업된 데이터를 현재 기기로 복원합니다. 복원 시 현재 데이터는 모두 삭제됩니다.
            {Platform.OS === 'ios' ? ' iCloud에서 복원하거나 백업 파일을 선택할 수 있습니다.' : ' 백업 파일을 선택하세요.'}
          </Text>
          <TouchableOpacity
            style={[styles.button, isLoading && styles.disabledButton]}
            onPress={handleRestore}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>복원하기</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            * 복원 후에는 앱을 다시 시작해야 합니다.
          </Text>
          <Text style={styles.noticeText}>
            * 다이어리 크기에 따라 백업 및 복원 시간이 길어질 수 있습니다.
          </Text>
          {Platform.OS === 'ios' && (
            <Text style={styles.noticeText}>
              * iCloud를 사용하려면 Apple ID로 로그인되어 있어야 합니다.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* 로딩 표시 */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>{loadingText}</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'white',
  },
  backButton: {
    fontSize: 24,
    marginRight: 16,
    color: '#666',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  disabledButton: {
    backgroundColor: '#B0B0B0',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 10,
  },
  notice: {
    marginTop: 20,
    marginBottom: 40,
    padding: 16,
  },
  noticeText: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 16,
    fontSize: 16,
  },
});

export default BackupRestoreScreen;