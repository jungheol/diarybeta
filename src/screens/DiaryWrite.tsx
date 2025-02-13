import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getDBConnection } from '../database/schema';

const DiaryWrite: React.FC = () => {
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const [content, setContent] = useState<string>('');
  const [images, setImages] = useState<string[]>([]);
  const currentDate = new Date();
  const { width: screenWidth } = Dimensions.get('window');

  const pickImage = async () => {
    if (images.length >= 10) {
      Alert.alert('알림', '사진은 최대 10장까지만 추가할 수 있습니다.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets[0].uri) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!content.trim()) return;

    try {
      const db = await getDBConnection();
      await db.withTransactionAsync(async () => {
        const diaryResult = await db.runAsync(
          `INSERT INTO diary_entry (child_id, content) VALUES (?, ?)`,
          [childId, content.trim()]
        );
        
        const diaryId = diaryResult.lastInsertRowId;
        
        for (const imageUri of images) {
          await db.runAsync(
            `INSERT INTO diary_picture (diary_entry_id, image_uri) VALUES (?, ?)`,
            [diaryId, imageUri]
          );
        }
      });
      
      router.back();
    } catch (error) {
      console.error('Failed to save diary entry:', error);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.date}>
          {currentDate.toLocaleDateString()} {currentDate.toLocaleTimeString()}
        </Text>
        <TouchableOpacity
          style={[styles.saveButton, !content.trim() && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!content.trim()}
        >
          <Text style={styles.saveButtonText}>✓</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.contentContainer}>
        <TextInput
          style={styles.input}
          multiline
          placeholder="오늘의 이야기를 기록해보세요..."
          value={content}
          onChangeText={setContent}
          textAlignVertical="top"
        />
        
        <View style={styles.imageContainer}>
          {images.map((uri, index) => (
            <View key={index} style={styles.imageWrapper}>
              <Image source={{ uri }} style={styles.image} />
              <TouchableOpacity 
                style={styles.removeButtonContainer}
                onPress={() => removeImage(index)}
              >
                <Text style={styles.removeButton}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          
          {images.length < 10 && (
            <TouchableOpacity 
              style={styles.addImageButton} 
              onPress={pickImage}
            >
              <Text style={styles.addImageButtonText}>+</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  date: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#E1E1E1',
  },
  saveButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  input: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 200,
  },
  imageContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 30,
    gap: 8,
  },
  imageWrapper: {
    position: 'relative',
    marginHorizontal: 5,
    marginVertical: 5,
  },
  image: {  // 해상도에 따른 이미지 사이즈 조절 필요
    width: (Dimensions.get('window').width - 60),
    height: (Dimensions.get('window').width - 60),
    borderRadius: 4,
  },
  removeButtonContainer: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  removeButton: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  addImageButton: {
    width: 50,
    height: 50,
    borderRadius: 4,
    backgroundColor: '#E1E1E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageButtonText: {
    fontSize: 24,
    color: '#666',
  },
});

export default DiaryWrite;