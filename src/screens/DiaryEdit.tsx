import React, { useState, useEffect } from 'react';
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
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getDBConnection } from '../database/schema';

const DiaryEdit: React.FC = () => {
  const router = useRouter();
  const { diaryId, childId } = useLocalSearchParams<{ diaryId: string; childId: string }>();
  const [content, setContent] = useState<string>('');
  const [createdAt, setCreatedAt] = useState<string>('');
  const [bookmark, setBookmark] = useState<number>(0);
  const [menuModalVisible, setMenuModalVisible] = useState<boolean>(false);
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    loadDiaryEntry();
  }, [diaryId]);

  const loadDiaryEntry = async () => {
    try {
      const db = await getDBConnection();
      // diary_entry 테이블에서 해당 diaryId의 내용을 가져옴
      const result = await db.getFirstAsync<{ content:string; created_at:string, bookmark: number }>(
        `SELECT content, created_at, bookmark FROM diary_entry WHERE id = ?`,
        [diaryId]
      );

      const imageResults = await db.getAllAsync<{ image_uri: string }>(
        `SELECT image_uri FROM diary_picture WHERE diary_entry_id = ? ORDER BY created_at ASC`,
        [diaryId]
      );

      if (result) {
        setContent(result.content);
        setCreatedAt(result.created_at);
        setBookmark(result.bookmark);
      }

      setImages(imageResults.map(img => img.image_uri));
    } catch (error) {
      console.error('Failed to load diary entry:', error);
    }
  };

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

  const handleUpdate = async () => {
    if (!content.trim()) return;

    try {
      const db = await getDBConnection();
      await db.withTransactionAsync(async () => {
        // 다이어리 내용 업데이트
        await db.runAsync(
          `UPDATE diary_entry SET content = ? WHERE id = ?`,
          [content.trim(), diaryId]
        );
        // 기존 이미지 삭제
        await db.runAsync(
          `DELETE FROM diary_picture WHERE diary_entry_id = ?`,
          [diaryId]
        );
        // 새 이미지 삽입 (images 배열에 저장된 이미지 URI 사용)
        for (const imageUri of images) {
          await db.runAsync(
            `INSERT INTO diary_picture (diary_entry_id, image_uri) VALUES (?, ?)`,
            [diaryId, imageUri]
          );
        }
      });
      router.back(); // 업데이트 후 MainScreen으로 돌아감
    } catch (error) {
      console.error('Failed to update diary entry:', error);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      "다이어리 삭제",
      "정말 이 다이어리를 삭제하시겠습니까?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              const db = await getDBConnection();
              await db.runAsync(`DELETE FROM diary_entry WHERE id = ?`, [diaryId]);
              router.back();
            } catch (error) {
              console.error('Failed to delete diary entry:', error);
            }
          },
        },
      ]
    );
  };

  const handleToggleBookmark = async () => {
    try {
      const newBookmark = bookmark === 1 ? 0 : 1;
      const db = await getDBConnection();
      await db.runAsync(`UPDATE diary_entry SET bookmark = ? WHERE id = ?`, [newBookmark, diaryId]);
      setBookmark(newBookmark);
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
    }
  };

  const openMenuModal = () => {
    setMenuModalVisible(true);
  };

  const closeMenuModal = () => {
    setMenuModalVisible(false);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.date}>
          {new Date(createdAt).toLocaleDateString()} {new Date(createdAt).toLocaleTimeString()}
        </Text>
        <View style={styles.buttonsContainer}>
          <TouchableOpacity style={styles.moreButton} onPress={openMenuModal}>
            <Text style={styles.moreButtonText}>⋮</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, !content.trim() && styles.saveButtonDisabled]}
            onPress={handleUpdate}
            disabled={!content.trim()}
          >
            <Text style={styles.saveButtonText}>✓</Text>
           </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView style={styles.contentContainer}>
        <TextInput
          style={styles.input}
          multiline
          placeholder="일기를 수정하세요..."
          value={content}
          onChangeText={setContent}
          textAlignVertical="top"
          autoFocus
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
      <Modal
        visible={menuModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeMenuModal}
      >
        <TouchableOpacity style={styles.modalOverlay} onPress={closeMenuModal}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalItem} onPress={handleToggleBookmark}>
              <Text style={styles.modalItemText}>
                {bookmark === 1 ? '즐겨찾기 해제' : '즐겨찾기'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalItem} onPress={handleDelete}>
              <Text style={[styles.modalItemText, { color: '#FF3B30' }]}>삭제하기</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={closeMenuModal}>
              <Text style={styles.modalCancelText}>취소</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  buttonsContainer: {
    justifyContent: 'space-between',
    width: 90,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
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
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 200,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    padding: 20,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  modalItem: {
    paddingVertical: 12,
  },
  modalItemText: {
    fontSize: 18,
    textAlign: 'center',
  },
  modalCancel: {
    marginTop: 10,
    paddingVertical: 12,
  },
  modalCancelText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#007AFF',
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

export default DiaryEdit;