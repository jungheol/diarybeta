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
  Image,
  Dimensions,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getDBConnection } from '../database/schema';
import { DiaryImage } from '../types';

const DiaryEdit: React.FC = () => {
  const router = useRouter();
  const { diaryId, childId } = useLocalSearchParams<{ diaryId: string; childId: string }>();
  const [text, setText] = useState<string>('');
  const [images, setImages] = useState<DiaryImage[]>([]);
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [createdAt, setCreatedAt] = useState<string>('');
  const [bookmark, setBookmark] = useState<number>(0);
  const [menuModalVisible, setMenuModalVisible] = useState<boolean>(false);

  useEffect(() => {
    loadDiaryEntry();
  }, [diaryId]);

  const loadDiaryEntry = async () => {
    try {
      const db = await getDBConnection();
      const result = await db.getFirstAsync<{ content: string; created_at: string; bookmark: number }>(
        `SELECT content, created_at, bookmark FROM diary_entry WHERE id = ?`,
        [diaryId]
      );

      const imageResults = await db.getAllAsync<{ image_uri: string; image_id: string }>(
        `SELECT image_uri, image_id FROM diary_picture 
         WHERE diary_entry_id = ? 
         ORDER BY created_at ASC`,
        [diaryId]
      );

      if (result) {
        setText(result.content);
        setCreatedAt(result.created_at);
        setBookmark(result.bookmark);
      }

      setImages(imageResults.map(img => ({
        id: img.image_id,
        uri: img.image_uri
      })));
    } catch (error) {
      console.error('Failed to load diary entry:', error);
    }
  };

  const insertImageMarker = (imageId: string, selectionStart: number) => {
    const before = text.slice(0, selectionStart);
    const after = text.slice(selectionStart);
    setText(`${before}\n[IMG:${imageId}]\n${after}`);
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
      const imageId = `${Date.now()}`;
      const newImage: DiaryImage = {
        id: imageId,
        uri: result.assets[0].uri
      };
      
      setImages([...images, newImage]);
      insertImageMarker(imageId, selection.start);
    }
  };

  const removeImage = (imageId: string) => {
    const newText = text.replace(new RegExp(`\\n?\\[IMG:${imageId}\\]\\n?`, 'g'), '\n');
    setText(newText.replace(/\n{3,}/g, '\n\n'));
    setImages(images.filter(img => img.id !== imageId));
  };

  const handleUpdate = async () => {
    if (!text.trim()) return;

    try {
      const db = await getDBConnection();
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `UPDATE diary_entry SET content = ? WHERE id = ?`,
          [text.trim(), diaryId]
        );

        await db.runAsync(
          `DELETE FROM diary_picture WHERE diary_entry_id = ?`,
          [diaryId]
        );

        for (const image of images) {
          await db.runAsync(
            `INSERT INTO diary_picture (diary_entry_id, image_uri, image_id) VALUES (?, ?, ?)`,
            [diaryId, image.uri, image.id]
          );
        }
      });
      
      router.back();
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
      await db.runAsync(
        `UPDATE diary_entry SET bookmark = ? WHERE id = ?`, 
        [newBookmark, diaryId]
      );
      setBookmark(newBookmark);
      setMenuModalVisible(false);
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
    }
  };

  const renderContent = () => {
    const parts = text.split(/(\[IMG:[^\]]+\])/);
    
    return parts.map((part, index) => {
      const match = part.match(/\[IMG:([^\]]+)\]/);
      if (match) {
        const imageId = match[1];
        const image = images.find(img => img.id === imageId);
        if (image) {
          return (
            <View key={index} style={styles.imageWrapper}>
              <Image source={{ uri: image.uri }} style={styles.image} />
              <TouchableOpacity 
                style={styles.removeButtonContainer}
                onPress={() => removeImage(image.id)}
              >
                <Text style={styles.removeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
          );
        }
      }
      return (
        <TextInput
          key={index}
          style={styles.input}
          multiline
          value={part}
          onChangeText={(newText) => {
            const newParts = [...parts];
            newParts[index] = newText;
            setText(newParts.join(''));
          }}
          onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
        />
      );
    });
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>◀</Text>
          </TouchableOpacity>
          <Text style={styles.date}>
            {new Date(createdAt).toLocaleDateString()} {new Date(createdAt).toLocaleTimeString()}
          </Text>
        </View>
        <View style={styles.buttonsContainer}>
          <TouchableOpacity 
            style={styles.moreButton} 
            onPress={() => setMenuModalVisible(true)}
          >
            <Text style={styles.moreButtonText}>⋮</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, !text.trim() && styles.saveButtonDisabled]}
            onPress={handleUpdate}
            disabled={!text.trim()}
          >
            <Text style={styles.saveButtonText}>✓</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.contentContainer}>
        <View style={styles.editorContainer}>
          {renderContent()}
        </View>
        
        <TouchableOpacity 
          style={[styles.addImageButton, images.length >= 10 && styles.addImageButtonDisabled]} 
          onPress={pickImage}
          disabled={images.length >= 10}
        >
          <Text style={styles.addImageButtonText}>사진 추가</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={menuModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          onPress={() => setMenuModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.modalItem} 
              onPress={handleToggleBookmark}
            >
              <Text style={styles.modalItemText}>
                {bookmark === 1 ? '즐겨찾기 해제' : '즐겨찾기'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.modalItem} 
              onPress={handleDelete}
            >
              <Text style={[styles.modalItemText, { color: '#FF3B30' }]}>
                삭제하기
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.modalCancel} 
              onPress={() => setMenuModalVisible(false)}
            >
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
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 60,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    fontSize: 24,
    color: '#666',
  },
  date: {
    fontSize: 16,
    color: '#666',
  },
  buttonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  editorContainer: {
    flex: 1,
    padding: 16,
  },
  input: {
    fontSize: 16,
    lineHeight: 24,
    padding: 0,
    textAlignVertical: 'top',
  },
  imageWrapper: {
    position: 'relative',
    marginVertical: 8,
    alignItems: 'center',
  },
  image: {
    width: Dimensions.get('window').width - 32,
    height: Dimensions.get('window').width - 32,
    borderRadius: 8,
  },
  removeButtonContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addImageButton: {
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 32,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  addImageButtonDisabled: {
    backgroundColor: '#E1E1E1',
  },
  addImageButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
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
    borderTopWidth: 1,
    borderTopColor: '#E1E1E1',
  },
  modalCancelText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#007AFF',
  },
});

export default DiaryEdit;