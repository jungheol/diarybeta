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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getDBConnection } from '../database/schema';

const DiaryEdit: React.FC = () => {
  const router = useRouter();
  const { diaryId, childId } = useLocalSearchParams<{ diaryId: string; childId: string }>();
  const [content, setContent] = useState<string>('');
  const [createdAt, setCreatedAt] = useState<string>('');
  const [bookmark, setBookmark] = useState<number>(0);
  const [menuModalVisible, setMenuModalVisible] = useState<boolean>(false);

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
      if (result) {
        setContent(result.content);
        setCreatedAt(result.created_at);
        setBookmark(result.bookmark);
      }
    } catch (error) {
      console.error('Failed to load diary entry:', error);
    }
  };

  const handleUpdate = async () => {
    if (!content.trim()) return;

    try {
      const db = await getDBConnection();
      await db.runAsync(
        `UPDATE diary_entry SET content = ? WHERE id = ?`,
        [content.trim(), diaryId]
      );
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
});

export default DiaryEdit;