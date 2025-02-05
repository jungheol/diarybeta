import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getDBConnection } from '../database/schema';
import { DiaryEntry } from '../types';

const MainScreen: React.FC = () => {
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);

  useEffect(() => {
    loadDiaryEntries();
  }, [childId]);

  const loadDiaryEntries = async () => {
    try {
      const db = await getDBConnection();
      const results = await db.getAllAsync<DiaryEntry>(
        `SELECT * FROM diary_entry WHERE child_id = ? ORDER BY created_at DESC`,
        [childId]
      );
      
      console.log("==============="+results+"===================");
      // const entries: DiaryEntry[] = [];
      // for (let i = 0; i < results.rows.length; i++) {
      //   entries.push(results.rows.item(i));
      // }
      setDiaryEntries(results);
    } catch (error) {
      console.error('Failed to load diary entries:', error);
    }
  };

  const renderDiaryEntry = ({ item }: { item: DiaryEntry }) => (
    <View style={styles.entryCard}>
      <Text style={styles.entryDate}>
        {new Date(item.createdAt).toLocaleDateString()}
      </Text>
      <Text style={styles.entryContent} numberOfLines={3}>
        {item.content}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={diaryEntries}
        renderItem={renderDiaryEntry}
        keyExtractor={item => item.id?.toString() || ''}
        contentContainerStyle={styles.listContainer}
      />
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push({
          pathname: '/diary-write',
          params: { childId: parseInt(childId) }
        })}
      >
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  listContainer: {
    padding: 16,
  },
  entryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  entryDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  entryContent: {
    fontSize: 16,
    color: '#333',
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  addButtonText: {
    fontSize: 32,
    color: '#FFFFFF',
    lineHeight: 32,
  },
});

export default MainScreen;