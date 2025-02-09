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
import { PanGestureHandler, State as GestureState } from 'react-native-gesture-handler';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getDBConnection } from '../database/schema';
import { DiaryEntry } from '../types';
import { Child } from '../types';

const MainScreen: React.FC = () => {
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [childInfos, setChildInfos] = useState<Child[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const loadDiaryEntries = async () => {
    try {
      const db = await getDBConnection();
      // 선택 월의 시작일과 다음 달 시작일을 구함.
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth(); // 0~11
      const start = `${year}-${(month + 1).toString().padStart(2, '0')}-01`;
      const nextMonthDate = new Date(year, month + 1, 1);
      const end = `${nextMonthDate.getFullYear()}-${(nextMonthDate.getMonth() + 1)
        .toString()
        .padStart(2, '0')}-01`;
      
      // SQL 쿼리에 날짜 범위 조건을 추가
      const results = await db.getAllAsync<DiaryEntry>(
        `SELECT 
          diary_entry.id, 
          diary_entry.created_at AS createdAt, 
          SUBSTR(diary_entry.content, 1, 10) AS content,
          JULIANDAY(diary_entry.created_at) - JULIANDAY(child.birth_date) AS days_since_birth
        FROM diary_entry
        INNER JOIN child ON diary_entry.child_id = child.id
        WHERE child.is_active = 1 
          AND child.id = ?
          AND diary_entry.created_at >= ? 
          AND diary_entry.created_at < ?
        ORDER BY diary_entry.created_at DESC`,
        [childId, start, end]
      );
      
      // 사용하는 DB 라이브러리에 따라 실제 데이터 배열 추출 방식이 다를 수 있음.
      setDiaryEntries(results);
    } catch (error) {
      console.error('Failed to load diary entries:', error);
    }
  };

  const loadChildInfos = async () => {
    try {
      const db = await getDBConnection();
      const result = await db.getAllAsync<Child>(
        `SELECT 
          first_name as firstName, 
          last_name as lastName, 
          photo_url as photoUrl, 
          is_active as isActive 
        FROM child`
      );
      setChildInfos(result);
    } catch (error) {
      console.error('Failed to load child infos:', error);
    }
  };

  const getCurrentMonthTitle = () => {
    return `${selectedDate.getFullYear()}년 ${selectedDate.getMonth() + 1}월`;
  };

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === GestureState.END) {
      const { translationX } = event.nativeEvent;
      const threshold = 50; // 스와이프 임계치 (픽셀 단위)
      if (translationX > threshold) {
        // 왼쪽 스와이프: 이전 달로 이동
        const newDate = new Date(selectedDate);
        newDate.setMonth(newDate.getMonth() - 1);
        setSelectedDate(newDate);
      } else if (translationX < -threshold) {
        // 오른쪽 스와이프: 다음 달로 이동 (단, 현재 월이 아닐 경우만)
        const now = new Date();
        if (
          selectedDate.getFullYear() < now.getFullYear() ||
          (selectedDate.getFullYear() === now.getFullYear() && selectedDate.getMonth() < now.getMonth())
        ) {
          const newDate = new Date(selectedDate);
          newDate.setMonth(newDate.getMonth() + 1);
          // 만약 새로 계산한 달이 현재 달보다 커지면 업데이트하지 않음.
          if (
            newDate.getFullYear() < now.getFullYear() ||
            (newDate.getFullYear() === now.getFullYear() && newDate.getMonth() <= now.getMonth())
          ) {
            setSelectedDate(newDate);
          }
        }
      }
    }
  };

  useEffect(() => {
    loadDiaryEntries();
  }, [childId, selectedDate]);

  useEffect(() => {
    loadChildInfos();
  }, [childId]);

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
    <PanGestureHandler onHandlerStateChange={onHandlerStateChange}>
      <SafeAreaView style={styles.container}>
        {/* 헤더 영역 */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.profileBtn} onPress={() => setProfileModalVisible(true)}>
            {/* 실제 사진 URI와 아이 데이터를 사용하세요 */}
            <Image 
              source={require('../../assets/images/profile.jpeg') } 
              style={styles.profileImage} 
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{getCurrentMonthTitle()}</Text>
        </View>
        
        {/* 다이어리 리스트 */}
        <FlatList
          data={diaryEntries}
          renderItem={renderDiaryEntry}
          keyExtractor={item => item.id?.toString() || ''}
          contentContainerStyle={styles.listContainer}
        />
        
        {/* 중앙 하단 Add 버튼 */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push({
            pathname: '/diary-write',
            params: { childId: parseInt(childId) }
          })}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>

        {/* 왼쪽 하단 메뉴 버튼 */}
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setMenuModalVisible(true)}
        >
          <Text style={styles.menuButtonText}>≡</Text>
        </TouchableOpacity>

        {/* 메뉴 모달 */}
        <Modal
          visible={menuModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setMenuModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.menuModal}>
              <TouchableOpacity style={styles.modalItem} onPress={() => { console.log("월별보기"); setMenuModalVisible(false); }}>
                <Text style={styles.modalItemText}>월별보기</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalItem} onPress={() => { console.log("즐겨찾기"); setMenuModalVisible(false); }}>
                <Text style={styles.modalItemText}>즐겨찾기</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalItem} onPress={() => { console.log("검색"); setMenuModalVisible(false); }}>
                <Text style={styles.modalItemText}>검색</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalItem} onPress={() => { console.log("설정"); setMenuModalVisible(false); }}>
                <Text style={styles.modalItemText}>설정</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setMenuModalVisible(false)}>
                <Text style={styles.modalCloseBtnText}>닫기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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
                ))
              ) : (
                <Text style={styles.modalChildName}>등록된 아이가 없습니다.</Text>
              )}
              <TouchableOpacity style={styles.addChildButton} onPress={() => console.log("아이 추가")}>
                <Text style={styles.addChildButtonText}>아이 추가</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setProfileModalVisible(false)}>
                <Text style={styles.modalCloseBtnText}>닫기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </PanGestureHandler>
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
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  profileBtn: {
    position: 'absolute',
    left: 16,
    top: 10,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    alignSelf: 'center',
    width: 108,
    height: 40,
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
  menuButton: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    width: 50,
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButtonText: {
    fontSize: 28,
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  /* 메뉴 모달 */
  menuModal: {
    width: '80%',
    backgroundColor: '#FFF',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  modalItem: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalItemText: {
    fontSize: 16,
  },
  modalCloseBtn: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  modalCloseBtnText: {
    fontSize: 16,
    color: '#007AFF',
  },
  /* 프로필 모달 */
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
});

export default MainScreen;