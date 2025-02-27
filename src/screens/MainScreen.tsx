import { useFocusEffect } from '@react-navigation/native';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Modal,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getDBConnection } from '../database/schema';
import { DiaryEntry, Child } from '../types';

interface GroupedDiaryEntry {
  daysSinceBirth: number;
  date: string;
  entries: DiaryEntry[];
}

const MainScreen: React.FC = () => {
  const router = useRouter();
  const [childInfos, setChildInfos] = useState<Child[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<GroupedDiaryEntry[]>([]);
  const [activeChildId, setActiveChildId] = useState<number | null>(null);
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const activeChild = childInfos.find(child => child.id === activeChildId);

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
    try {
      const db = await getDBConnection();
      
      // 최신순으로 모든 다이어리를 가져오는 쿼리로 변경
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
        WHERE child.is_active = 1 
          AND child.id = ?
        ORDER BY diary_entry.created_at DESC`,
        [activeChildId]
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
      daysSinceBirth: entries[0].days_since_birth, // Use the first entry's days
      date,
      entries
    }));
  };

  const loadChildInfos = async () => {
    try {
      const db = await getDBConnection();
      const result = await db.getAllAsync<Child>(
        `SELECT 
          id,
          first_name as firstName, 
          last_name as lastName, 
          photo_url as photoUrl, 
          is_active as isActive 
        FROM child`
      );
      setChildInfos(result);
      const active = result.find(child => child.isActive === 1);
      if (active) {
        setActiveChildId(active.id);
      }
    } catch (error) {
      console.error('Failed to load child infos:', error);
    }
  };

  const handleProfileChange = async (child: Child) => {
    try {
      if (child.isActive === 1) {
        setProfileModalVisible(false);
        return;
      }

      const db = await getDBConnection();
      await db.runAsync('BEGIN TRANSACTION');
    
      try {
        // 현재 활성화된 프로필 비활성화
        await db.runAsync('UPDATE child SET is_active = 0 WHERE is_active = 1');
        
        // 선택한 프로필 활성화
        await db.runAsync('UPDATE child SET is_active = 1 WHERE id = ?', [child.id]);
        
        // 트랜잭션 완료
        await db.runAsync('COMMIT');
        
        // 데이터 새로고침
        await loadChildInfos();
        await loadDiaryEntries();
        setProfileModalVisible(false);
      } catch (error) {
        // 에러 발생 시 트랜잭션 롤백
        await db.runAsync('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Failed to change profile:', error);
    }
  };

  const handleAddChild = () => {
    setProfileModalVisible(false);
    router.push({
      pathname: '/profile-create',
      params: { isAdditionalProfile: 'true' }
    });
  };

  // 의존성: activeChildId가 변경될 때 다이어리 로드
  useEffect(() => {
    if (activeChildId) {
      loadDiaryEntries();
    }
  }, [activeChildId]);

  // 컴포넌트가 마운트될 때 자녀 정보를 불러옴
  useEffect(() => {
    loadChildInfos();
  }, []);

  // 화면이 포커스될 때마다 다이어리 리스트 새로 로드 (새 다이어리 작성 후 돌아올 때 등)
  useFocusEffect(
    useCallback(() => {
      if (activeChildId) {
        loadDiaryEntries();
      }
    }, [activeChildId])
  );

  const renderEntry = (entry: DiaryEntry, isFirst: boolean) => {
    // 날짜와 시간을 분리하여 표시
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
            {/* 작성 시간이 먼저 표시되도록 순서 변경 */}
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

  // Render group of entries
  const renderDiaryGroup = ({ item }: { item: GroupedDiaryEntry }) => (
    <View style={styles.groupContainer}>
      {item.entries.map((entry, index) => renderEntry(entry, index === 0))}
    </View>
  );

  const openProfileModal = () => {
    setProfileModalVisible(true);
  };

  // 하단 탭바 메뉴 항목
  const navigateToMonthly = () => {
    router.push('/monthly');
  };

  const navigateToSearch = () => {
    router.push({
      pathname: '/search',
      params: { childId: activeChildId }
    });
  };

  const navigateToAddDiary = () => {
    router.push({
      pathname: '/diary-write',
      params: { childId: activeChildId }
    });
  };

  const navigateToFavorites = () => {
    router.push('/favorites');
  };

  const navigateToSettings = () => {
    console.log("설정 기능");
    // 설정 화면으로 이동
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 영역 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.profileBtn} onPress={openProfileModal}>
            <Image 
              source={activeChild?.photoUrl ? { uri: activeChild.photoUrl } : require('../../assets/images/profile.jpeg')}
              style={styles.profileImage}
            />
          </TouchableOpacity>
          
          {/* 아이 이름 및 드롭다운 아이콘 */}
          <TouchableOpacity style={styles.childNameContainer} onPress={openProfileModal}>
            <Text style={styles.childName}>
              {activeChild ? `${activeChild.lastName} ${activeChild.firstName}` : '아이 정보 없음'}
            </Text>
            <Text style={styles.dropdownIcon}>∨</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* 다이어리 리스트 */}
      <FlatList
        data={diaryEntries}
        renderItem={renderDiaryGroup}
        keyExtractor={item => item.date}
        contentContainerStyle={styles.listContainer}
      />
      
      {/* 하단 탭바 */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={navigateToMonthly}>
          <Text style={styles.tabIcon}>📅</Text>
          <Text style={styles.tabLabel}>월별보기</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.tabItem} onPress={navigateToSearch}>
          <Text style={styles.tabIcon}>🔍</Text>
          <Text style={styles.tabLabel}>검색</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.tabItemCenter} onPress={navigateToAddDiary}>
          <View style={styles.addDiaryButton}>
            <Text style={styles.addDiaryButtonText}>+</Text>
          </View>
          <Text style={styles.tabLabel}>추가</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.tabItem} onPress={navigateToFavorites}>
          <Text style={styles.tabIcon}>⭐</Text>
          <Text style={styles.tabLabel}>즐겨찾기</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.tabItem} onPress={navigateToSettings}>
          <Text style={styles.tabIcon}>⚙️</Text>
          <Text style={styles.tabLabel}>설정</Text>
        </TouchableOpacity>
      </View>

      {/* 프로필 모달 */}
      <Modal
        visible={profileModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.profileModal}>
            {childInfos.length > 0 ? (
              childInfos.map((child, index) => (
                <TouchableOpacity key={index} onPress={() => handleProfileChange(child)}>
                  <View key={index} style={styles.childRow}>
                    <Image 
                      source={child.photoUrl ? { uri: child.photoUrl } : require('../../assets/images/profile.jpeg')}
                      style={styles.modalProfileImage}
                    />
                    <View style={styles.childInfoContainer}>
                      <Text style={styles.modalChildName}>
                        {child.lastName} {child.firstName}
                      </Text>
                      <Text style={[
                        styles.childStatusLabel, 
                        child.isActive === 1 ? styles.activeLabel : styles.inactiveLabel
                      ]}>
                        {child.isActive === 1 ? '활성화됨' : '비활성'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.modalChildName}>등록된 아이가 없습니다.</Text>
            )}
            <TouchableOpacity 
              style={styles.addChildButton} 
              onPress={handleAddChild}
            >
              <Text style={styles.addChildButtonText}>아이 추가</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.modalCloseBtn} 
              onPress={() => setProfileModalVisible(false)}
            >
              <Text style={styles.modalCloseBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileBtn: {
    marginRight: 12,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  childNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  childName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  dropdownIcon: {
    fontSize: 14,
    color: '#333',
    marginLeft: 4,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100, // 하단 탭바 공간 확보
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
  entryContent: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
    width: '100%',
  },
  entryDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4, // 날짜와 내용 사이 간격 추가
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
  // 하단 탭바 스타일
  tabBar: {
    flexDirection: 'row',
    height: 80,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 10, // 아이폰 홈 인디케이터 공간
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 8,
  },
  tabItemCenter: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  tabIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    color: '#666',
  },
  addDiaryButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  addDiaryButtonText: {
    fontSize: 28,
    color: '#FFFFFF',
    lineHeight: 32,
  },
  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileModal: {
    width: '80%',
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  childInfoContainer: {
    marginLeft: 8,
  },
  modalProfileImage: {
    width: 40,
    height: 40,
    borderRadius: 40,
  },
  modalChildName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  childStatusLabel: {
    fontSize: 14,
    marginTop: 2,
  },
  activeLabel: {
    color: 'green',
  },
  inactiveLabel: {
    color: 'gray',
  },
  addChildButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  addChildButtonText: {
    color: '#FFF',
    fontSize: 16,
  },
  modalCloseBtn: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    width: '100%',
  },
  modalCloseBtnText: {
    fontSize: 16,
    color: '#007AFF',
  },
});

export default MainScreen;