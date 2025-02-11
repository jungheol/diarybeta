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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getDBConnection } from '../database/schema';

const DiaryEdit: React.FC = () => {
  const router = useRouter();
  const { diaryId, childId } = useLocalSearchParams<{ diaryId: string; childId: string }>();
  const [content, setContent] = useState<string>('');
  const [createdAt, setCreatedAt] = useState<string>('');

  useEffect(() => {
    loadDiaryEntry();
  }, [diaryId]);

  const loadDiaryEntry = async () => {
    try {
      const db = await getDBConnection();
      // diary_entry 테이블에서 해당 diaryId의 내용을 가져옴
      const result = await db.getFirstAsync<{ content:string; created_at:string }>(
        `SELECT content, created_at FROM diary_entry WHERE id = ?`,
        [diaryId]
      );
      if (result) {
        setContent(result.content);
        setCreatedAt(result.created_at);
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

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.date}>
          {new Date(createdAt).toLocaleDateString()} {new Date(createdAt).toLocaleTimeString()}
        </Text>
        <TouchableOpacity
          style={[styles.saveButton, !content.trim() && styles.saveButtonDisabled]}
          onPress={handleUpdate}
          disabled={!content.trim()}
        >
          <Text style={styles.saveButtonText}>✓</Text>
        </TouchableOpacity>
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
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 200,
  },
});

export default DiaryEdit;