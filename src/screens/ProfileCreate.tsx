import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Text,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getDBConnection, insertChild } from '../database/schema';

const ProfileCreate: React.FC = () => {
  const router = useRouter();
  const { isAdditionalProfile } = useLocalSearchParams<{ isAdditionalProfile?: string }>();
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isDatePickerVisible, setDatePickerVisible] = useState<boolean>(false);
  

  const isFormValid = firstName && lastName && birthDate;

  const handleImagePicker = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      setPhotoUri(result.assets[0].uri);
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

      if (isAdditionalProfile === 'true') {
        await db.runAsync('UPDATE child SET is_active = 0 WHERE is_active = 1');
      }

      const childId = await insertChild(db, {
        firstName,
        lastName,
        birthDate: birthDate!.toISOString(),
        photoUrl: photoUri || undefined,
        isActive: 1,
      });
      
      router.replace({
        pathname: '/main',
        params: { childId }
      });
    } catch (error) {
      console.error('Failed to create profile:', error);
    }
  };

  return (
    <View style={styles.container}>
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
          {birthDate ? birthDate.toLocaleDateString() : '생년월일 선택'}
        </Text>
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirm}
        onCancel={hideDatePicker}
      />

      <TouchableOpacity
        style={[styles.button, !isFormValid && styles.buttonDisabled]}
        disabled={!isFormValid}
        onPress={handleSubmit}
      >
        <Text style={styles.buttonText}>
          {isAdditionalProfile === 'true' ? '프로필 추가' : '시작하기'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FFFFFF',
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
});

export default ProfileCreate;