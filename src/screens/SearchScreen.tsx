// app/search.tsx
import { useFocusEffect } from '@react-navigation/native';
import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView,
  Image,
  ActivityIndicator,
  TextInput
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getDBConnection } from '../database/schema';
import { DiaryEntry } from '../types';

interface GroupedDiaryEntry {
  daysSinceBirth: number;
  date: string;
  entries: DiaryEntry[];
}

const SearchScreen: React.FC = () => {
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lastSearchedQuery, setLastSearchedQuery] = useState<string>('');
  const [diaryEntries, setDiaryEntries] = useState<GroupedDiaryEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  
  // HTML 태그를 제거하고 텍스트만 추출하는 함수
  const getPlainTextPreview = (html: string, maxLength: number = 30): string => {
    if (!html) return '';
    
    // img 태그 특별 처리 (이미지 태그를 "[이미지]"로 대체)
    let processedHtml = html.replace(/<img[^>]*>/g, ' ');
    
    // HTML 태그 제거
    const withoutTags = processedHtml.replace(/<[^>]*>/g, ' ');
    
    // HTML 엔티티 변환
    const withoutEntities = withoutTags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    // 텍스트 정리 (연속된 공백 제거)
    const cleanText = withoutEntities.replace(/\s+/g, ' ').trim();
    
    // 최대 길이로 자르기
    return cleanText.length > maxLength 
      ? cleanText.substring(0, maxLength) + '...' 
      : cleanText;
  };

  const performSearch = async () => {
    if (!searchQuery.trim() || !childId) return;
    
    try {
      setLoading(true);
      setHasSearched(true);
      setLastSearchedQuery(searchQuery.trim());
      
      const db = await getDBConnection();
      
      // SQL LIKE를 사용하여 검색어가 포함된 다이어리 검색
      const results = await db.getAllAsync<DiaryEntry>(
        `SELECT 
          diary_entry.id, 
          diary_entry.created_at AS createdAt, 
          diary_entry.content,
          JULIANDAY(diary_entry.created_at) - JULIANDAY(child.birth_date) AS days_since_birth,
          (SELECT image_uri FROM diary_picture 
            WHERE diary_entry_id = diary_entry.id 
            ORDER BY created_at ASC LIMIT 1) as thumbnailUri
        FROM diary_entry
        INNER JOIN child ON diary_entry.child_id = child.id
        WHERE child.id = ? 
          AND diary_entry.content LIKE ?
        ORDER BY diary_entry.created_at DESC`, 
        [childId, `%${searchQuery}%`]
      );

      const groupedEntries = groupEntriesByDate(results);
      setDiaryEntries(groupedEntries);
    } catch (error) {
      console.error('Failed to perform search:', error);
    } finally {
      setLoading(false);
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

  const handleSearch = () => {
    if (searchQuery.trim()) {
      performSearch();
    }
  };

  const renderEntry = (entry: DiaryEntry, isFirst: boolean) => {
    const createdDate = new Date(entry.createdAt);
    const formattedDate = createdDate.toLocaleDateString('ko-KR');
    const formattedTime = createdDate.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    return (
      <TouchableOpacity
        key={entry.id}
        onPress={() =>
          router.push({
            pathname: '/diary-edit',
            params: { diaryId: entry.id, childId },
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
            <Text style={styles.entryDate}>
              {formattedDate} {formattedTime}
            </Text>
            <Text 
              style={styles.entryContent} 
              numberOfLines={1} 
              ellipsizeMode="tail"
            >
              {getPlainTextPreview(entry.content, 20)}
            </Text>
          </View>
          
          {entry.thumbnailUri && (
            <View style={styles.thumbnailContainer}>
              <Image 
                source={{ uri: entry.thumbnailUri }} 
                style={styles.thumbnailImage}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderDiaryGroup = ({ item }: { item: GroupedDiaryEntry }) => (
    <View style={styles.groupContainer}>
      {item.entries.map((entry, index) => renderEntry(entry, index === 0))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 영역 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonContainer}>
          <Text style={styles.backButton}>◀</Text>
        </TouchableOpacity>
        
        {/* 검색창 */}
        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="다이어리 내용 검색"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            autoFocus
          />
          <TouchableOpacity 
            style={[
              styles.searchIconButton,
              !searchQuery.trim() && styles.disabledIconButton
            ]}
            onPress={handleSearch}
            disabled={!searchQuery.trim()}
          >
            <Text style={styles.searchIcon}>🔍</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* 로딩 상태 표시 */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        /* 다이어리 리스트 또는 결과 없음 메시지 */
        hasSearched ? (
          diaryEntries.length > 0 ? (
            <FlatList
              data={diaryEntries}
              renderItem={renderDiaryGroup}
              keyExtractor={item => item.date}
              contentContainerStyle={styles.listContainer}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                '{lastSearchedQuery}' 검색 결과가 없습니다.
              </Text>
            </View>
          )
        ) : (
          <View style={styles.initialContainer}>
            <Text style={styles.initialText}>
              검색어를 입력해 주세요.
            </Text>
          </View>
        )
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    height: 70,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'white',
  },
  backButtonContainer: {
    paddingRight: 16,
  },
  backButton: {
    fontSize: 24,
    color: '#666',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  searchInput: {
    height: 44,
    backgroundColor: '#F0F0F0',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingRight: 48,
    flex: 1,
  },
  searchIconButton: {
    position: 'absolute',
    right: 6,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  disabledIconButton: {
    backgroundColor: '#CCCCCC',
  },
  searchIcon: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  initialContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 100,
  },
  initialText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
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
    width: '100%',
    overflow: 'hidden',
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 0,
    paddingRight: 12,
  },
  diaryCard: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  subsequentEntry: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 82,
  },
  daysSinceContainer: {
    width: 64,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginRight: 12,
    flexShrink: 0,
    paddingLeft: 4,
  },
  daysSince: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    paddingLeft: 4,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 56,
    paddingLeft: 4,
  },
  indentedContent: {
    marginLeft: 2,
  },
  entryDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  entryContent: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
    width: '100%',
  },
  thumbnailContainer: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 40,
    height: 40,
  },
  thumbnailImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
  },
});

export default SearchScreen;