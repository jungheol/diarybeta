import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getDBConnection } from '../database/schema';
import { DiaryEntry } from '../types';

interface GroupedDiaryEntry {
  daysSinceBirth: number;
  date: string;
  entries: DiaryEntry[];
}

const MonthlyDetailScreen: React.FC = () => {
  const router = useRouter();
  const { yearMonth, childId } = useLocalSearchParams<{ yearMonth: string; childId: string }>();
  const [diaryEntries, setDiaryEntries] = useState<GroupedDiaryEntry[]>([]);
  const [monthTitle, setMonthTitle] = useState<string>('');

  // HTML 태그를 제거하고 텍스트만 추출하는 함수
  const getPlainTextPreview = (html: string, maxLength: number = 30): string => {
    if (!html) return '';

    // img 태그 특별 처리 (이미지 태그를 "[이미지]"로 대체)
    let processedHtml = html.replace(/<img[^>]*>/g, ' ');

    // HTML 태그 제거
    const withoutTags = processedHtml.replace(/<[^>]*>/g, ' ');
    
    // HTML 엔티티 변환 (예: &nbsp;, &amp; 등)
    const withoutEntities = withoutTags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    // 텍스트 정리 (연속된 공백, 탭, 줄바꿈 등을 하나의 공백으로 대체)
    const cleanText = withoutEntities.replace(/\s+/g, ' ').trim();
    
    // 최대 길이로 자르기
    return cleanText.length > maxLength 
      ? cleanText.substring(0, maxLength) + '...' 
      : cleanText;
  };

  const loadDiaryEntries = async () => {
    if (!yearMonth || !childId) return;

    try {
      const db = await getDBConnection();
      
      // 해당 월의 시작일과 다음 달 시작일을 구함
      const [year, month] = yearMonth.split('-');
      const start = `${year}-${month}-01`;
      const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
      const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
      const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
      
      // 화면 상단에 표시할 월 제목 설정
      setMonthTitle(`${year}년 ${parseInt(month)}월`);
      
      // 해당 월의 다이어리 항목 불러오기
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
          AND diary_entry.created_at >= ? 
          AND diary_entry.created_at < ?
        ORDER BY diary_entry.created_at DESC`,
        [childId, start, end]
      );
      
      const groupedEntries = groupEntriesByDate(results);
      setDiaryEntries(groupedEntries);
    } catch (error) {
      console.error('Failed to load diary entries:', error);
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

  useEffect(() => {
    loadDiaryEntries();
  }, [yearMonth, childId]);

  const renderEntry = (entry: DiaryEntry, isFirst: boolean) => {
    const createdDate = new Date(entry.createdAt);
    const formattedDate = createdDate.toLocaleDateString('ko-KR'); // 날짜
    const formattedTime = createdDate.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }); // 시간
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>◀</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{monthTitle}</Text>
      </View>

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
    marginBottom: 8,
  },
  backButton: {
    fontSize: 24,
    marginRight: 16,
    color: '#666',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
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
    paddingRight: 4,
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
    marginBottom: 4, // 날짜와 내용 사이 간격 추가
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

export default MonthlyDetailScreen;