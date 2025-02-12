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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getDBConnection } from '../database/schema';

const DiaryWrite: React.FC = () => {
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const [content, setContent] = useState<string>('');
  const currentDate = new Date();

  const handleSave = async () => {
    if (!content.trim()) return;

    try {
      const db = await getDBConnection();
      await db.runAsync(
        `INSERT INTO diary_entry (child_id, content, created_at)
          VALUES (?, ?, datetime('now', 'localtime'))`,
        [childId, content.trim()]
      );
      
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

export default DiaryWrite;