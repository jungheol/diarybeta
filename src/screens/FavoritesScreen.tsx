import { useFocusEffect } from '@react-navigation/native';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getDBConnection } from '../database/schema';
import { DiaryEntry, Child } from '../types';

interface GroupedDiaryEntry {
  daysSinceBirth: number;
  date: string;
  entries: DiaryEntry[];
}

const FavoritesScreen: React.FC = () => {
  const router = useRouter();
  const [diaryEntries, setDiaryEntries] = useState<GroupedDiaryEntry[]>([]);
  const [activeChildId, setActiveChildId] = useState<number | null>(null);

  const loadFavorites = async () => {
    try {
      const db = await getDBConnection();
      const query = `
        SELECT 
          diary_entry.id, 
          diary_entry.created_at AS createdAt, 
          SUBSTR(diary_entry.content, 1, 10) AS content,
          JULIANDAY(diary_entry.created_at) - JULIANDAY(child.birth_date) AS days_since_birth
        FROM diary_entry
        INNER JOIN child ON diary_entry.child_id = child.id
        WHERE child.is_active = 1 
          AND child.id = ?
          AND diary_entry.bookmark = 1
        ORDER BY diary_entry.created_at DESC
      `;
      const params = [activeChildId];
      const results = await db.getAllAsync<DiaryEntry>(query, params);
      const groupedEntries = groupEntriesByDate(results);
      setDiaryEntries(groupedEntries);
    } catch (error) {
      console.error('Failed to load favorite diary entries:', error);
    }
  };

  const groupEntriesByDate = (entries: DiaryEntry[]): GroupedDiaryEntry[] => {
    const groups: { [key: string]: DiaryEntry[] } = {};
    
    entries.forEach(entry => {
      const date = new Date(entry.createdAt).toLocaleDateString('ko-KR');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(entry);
    });
    
    return Object.entries(groups).map(([date, entries]) => ({
      daysSinceBirth: entries[0].days_since_birth,
      date,
      entries
    }));
  };

  // activeChildId는 MainScreen과 동일한 로직으로 가져옵니다.
  const loadActiveChild = async () => {
    try {
      const db = await getDBConnection();
      const result = await db.getAllAsync<Child>(
        `SELECT 
          id,
          is_active as isActive 
         FROM child`
      );
      const active = result.find(child => child.isActive === 1);
      if (active) {
        setActiveChildId(active.id);
      }
    } catch (error) {
      console.error('Failed to load child infos:', error);
    }
  };

  useEffect(() => {
    loadActiveChild();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (activeChildId) {
        loadFavorites();
      }
    }, [activeChildId])
  );

  const renderEntry = (entry: DiaryEntry, isFirst: boolean) => (
    <TouchableOpacity
      key={entry.id}
      onPress={() =>
        router.push({
          pathname: '/diary-edit',
          params: { diaryId: entry.id, childId: activeChildId },
        })
      }
    >
      <View style={[styles.diaryCard, !isFirst && styles.subsequentEntry]}>
        {isFirst && (
          <View style={styles.daysSinceContainer}>
            <Text style={styles.daysSince}>
              {Math.floor(entry.days_since_birth) >= 0 
                ? `+${Math.floor(entry.days_since_birth)}` 
                : `${Math.floor(entry.days_since_birth)}`}
            </Text>
          </View>
        )}
        <View style={[styles.contentContainer, !isFirst && styles.indentedContent]}>
          <Text style={styles.entryContent} numberOfLines={1}>
            {entry.content}
          </Text>
          <Text style={styles.entryDate}>
            {new Date(entry.createdAt).toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderDiaryGroup = ({ item }: { item: GroupedDiaryEntry }) => (
    <View style={styles.groupContainer}>
      {item.entries.map((entry, index) => renderEntry(entry, index === 0))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 영역 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>◀</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>즐겨찾기</Text>
      </View>
      
      {/* 다이어리 리스트 */}
      <FlatList
        data={diaryEntries}
        renderItem={renderDiaryGroup}
        keyExtractor={item => item.date}
        contentContainerStyle={styles.listContainer}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    fontSize: 24,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 16,
  },
  groupContainer: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  diaryCard: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'transparent',
  },
  subsequentEntry: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 82,
  },
  indentedContent: {
    marginLeft: 0,
  },
  daysSinceContainer: {
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  daysSince: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  entryDate: {
    fontSize: 14,
    color: '#666',
  },
  entryContent: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
});

export default FavoritesScreen;
