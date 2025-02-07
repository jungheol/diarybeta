import { useFocusEffect } from '@react-navigation/native';
import React, { useState, useCallback } from 'react';
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

  useFocusEffect(
    useCallback(() => {
      loadDiaryEntries();
    }, [childId])
  );

  const loadDiaryEntries = async () => {
    try {
      const db = await getDBConnection();
      const results = await db.getAllAsync<DiaryEntry>(
        `SELECT 
          diary_entry.id, 
          diary_entry.created_at AS createdAt, 
          SUBSTR(diary_entry.content, 1, 10) AS content,
          JULIANDAY(diary_entry.created_at) - JULIANDAY(child.birth_date) AS days_since_birth
        FROM diary_entry
        INNER JOIN child ON diary_entry.child_id = child.id
        WHERE child.is_active = 1 AND child.id = ?
        ORDER BY diary_entry.created_at DESC`,
        [childId]
      );
      
      setDiaryEntries(results);
    } catch (error) {
      console.error('Failed to load diary entries:', error);
    }
  };

  const renderDiaryEntry = ({ item }: { item: DiaryEntry }) => {
    const createdDate = new Date(item.createdAt);
    
    return (
      <TouchableOpacity
        onPress={() =>
          router.push({
            pathname: '/diary-edit',
            params: { diaryId: item.id, childId: childId },
          })
        }
      >
        <View style={styles.diaryCard}>
          <View style={styles.daysSinceContainer}>
            <Text style={styles.daysSince}>+{Math.floor(item.days_since_birth)}</Text>
          </View>
          <View style={styles.contentContainer}>
            <Text style={styles.entryContent} numberOfLines={1}>
              {item.content}
            </Text>
            <Text style={styles.entryDate}>
              {createdDate.toLocaleString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              })}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
  listContainer: {  // 다이어리 리스트 뿌려주는 공간
    padding: 16,
  },
  diaryCard: {  // 다이어리 카드
    flexDirection: 'row',
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
  daysSinceContainer: {  // 날짜 text 들어가는 공간
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  daysSince: {  // +5 날짜 text 표시
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  contentContainer: {  // 다이어리 내용과 날짜 나오는 영역
    flex: 1,
    justifyContent: 'center',
  },
  entryDate: {  // diary 날짜
    fontSize: 14,
    color: '#666'
  },
  entryContent: {  // diary 첫 줄 내용
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  addButton: {  // addbutton 추후 수정
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