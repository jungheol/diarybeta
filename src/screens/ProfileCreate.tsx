import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Text,
  SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getDBConnection, insertChild } from '../database/schema';
import { saveImage, getImageUri } from '../services/ImageService';
import { Alert } from 'react-native';

const ProfileCreate: React.FC = () => {
  const router = useRouter();
  const { isAdditionalProfile, isEdit, childId, firstName: initialFirstName, lastName: initialLastName, photoUrl: initialPhotoUrl, birthDate: initialBirthDate } = useLocalSearchParams<{ 
    isAdditionalProfile?: string;
    isEdit?: string;
    childId?: string;
    firstName?: string;
    lastName?: string;
    photoUrl?: string;
    birthDate?: string;
  }>();  
  const [firstName, setFirstName] = useState<string>(initialFirstName || '');
  const [lastName, setLastName] = useState<string>(initialLastName || '');
  const [birthDate, setBirthDate] = useState<Date | null>(
    initialBirthDate ? new Date(initialBirthDate) : null
  );  
  const [photoUri, setPhotoUri] = useState<string | null>(initialPhotoUrl || null);
  const [savedPhotoPath, setSavedPhotoPath] = useState<string | null>(null); // DB 저장용 상대 경로
  const [isDatePickerVisible, setDatePickerVisible] = useState<boolean>(false);

  const isEditMode = isEdit === 'true';
  const isFormValid = firstName && lastName && birthDate;

  useEffect(() => {
    // 수정 모드일 때 DB에서 자녀 정보 로드
    if (isEditMode && childId) {
      loadChildData();
    }
  }, [isEditMode, childId]);

  const loadChildData = async () => {
    if (!childId) return;

    try {
      const db = await getDBConnection();
      const result = await db.getAllAsync<{
        firstName: string;
        lastName: string;
        photoUrl: string | null;
        birthDate: string;
      }>(
        `SELECT 
          first_name as firstName,
          last_name as lastName,
          photo_url as photoUrl,
          birth_date as birthDate
        FROM child
        WHERE id = ?`,
        [childId]
      );

      if (result.length > 0) {
        const child = result[0];
        setFirstName(child.firstName);
        setLastName(child.lastName);
        
        if (child.photoUrl) {
          setSavedPhotoPath(child.photoUrl);
          
          // 이미지 URI 가져오기
          try {
            const uri = await getImageUri(child.photoUrl, null);
            setPhotoUri(uri);
          } catch (error) {
            console.error('Error loading profile image:', error);
          }
        }
        
        if (child.birthDate) {
          setBirthDate(new Date(child.birthDate));
        }
      }
    } catch (error) {
      console.error('Failed to load child data:', error);
    }
  };

  const handleImagePicker = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      try {
        // 선택된 이미지를 영구 저장소에 저장
        const selectedUri = result.assets[0].uri;
        const savedRelativePath = await saveImage(
          selectedUri, 
          'profiles', 
          `profile_${Date.now()}.jpg`
        );
        
        // 원본 이미지 URI 임시 저장 (화면 표시용)
        setPhotoUri(selectedUri);
        
        // 나중에 폼 제출 시 사용할 상대 경로 저장
        setSavedPhotoPath(savedRelativePath);
      } catch (error) {
        console.error('Error saving profile image:', error);
        Alert.alert('오류', '프로필 이미지를 저장하는 중 문제가 발생했습니다.');
      }
    }
  };

  const showDatePicker = () => {
    setDatePickerVisible(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisible(false);
  };

  const handleConfirm = (date: Date) => {
    setBirthDate(date);
    hideDatePicker();
  };

  const handleSubmit = async () => {
    if (!isFormValid) return;

    try {
      const db = await getDBConnection();
      
      if (isEditMode && childId) {
        // 프로필 수정 모드
        await db.runAsync(
          `UPDATE child SET 
            first_name = ?, 
            last_name = ?, 
            birth_date = ?,
            photo_url = ?
          WHERE id = ?`,
          [
            firstName,
            lastName,
            birthDate!.toISOString(),
            savedPhotoPath,
            childId
          ]
        );
        
        router.replace({
          pathname: '/main',
          params: { childId }
        });
      } else {
        if (isAdditionalProfile === 'true') {
          await db.runAsync('UPDATE child SET is_active = 0 WHERE is_active = 1');
        }

        const childId = await insertChild(db, {
          firstName,
          lastName,
          birthDate: birthDate!.toISOString(),
          photoUrl: savedPhotoPath || undefined,
          isActive: 1,
        });
        
        router.replace({
          pathname: '/main',
          params: { childId }
        });
      }
    } catch (error) {
      console.error('Failed to create profile:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {(isAdditionalProfile === 'true' || isEditMode) && (
          <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>◀</Text>
        </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleImagePicker}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>사진 추가</Text>
            </View>
          )}
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="성"
          value={lastName}
          onChangeText={setLastName}
        />

        <TextInput
          style={styles.input}
          placeholder="이름"
          value={firstName}
          onChangeText={setFirstName}
        />

        <TouchableOpacity style={styles.input} onPress={showDatePicker}>
          <Text style={birthDate ? styles.dateText : styles.datePlaceholder}>
          {birthDate 
            ? `${birthDate.toLocaleDateString()} ${birthDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
            : '생년월일 선택'}
          </Text>
        </TouchableOpacity>

        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="datetime"
          onConfirm={handleConfirm}
          onCancel={hideDatePicker}
          date={birthDate || new Date()}
          display='inline'
        />

        <TouchableOpacity
          style={[styles.button, !isFormValid && styles.buttonDisabled]}
          disabled={!isFormValid}
          onPress={handleSubmit}
        >
          <Text style={styles.buttonText}>
            {isEditMode ? '저장하기' : (isAdditionalProfile === 'true' ? '프로필 추가' : '시작하기')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    paddingTop: 80,
    padding: 20,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: 'center',
    marginBottom: 20,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E1E1E1',
    alignSelf: 'center',
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    color: '#666',
  },
  input: {
    width: '100%',
    height: 48,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 8,
    justifyContent: 'center',
  },
  dateText: {
    color: '#000',
  },
  datePlaceholder: {
    color: '#666',
  },
  button: {
    width: '100%',
    height: 48,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    backgroundColor: '#E1E1E1',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 1,
    padding: 10,
  },
  backButtonText: {
    fontSize: 24,
    color: '#666',
  },
});

export default ProfileCreate;