import { useFocusEffect } from '@react-navigation/native';
import React, { useState, useCallback } from 'react';
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
  const [childInfo, setChildInfo] = useState<Child | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadDiaryEntries();
      loadChildInfo();
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

  const loadChildInfo = async () => {
    try {
      const db = await getDBConnection();
      const result = await db.getFirstAsync<Child>(
        `SELECT first_name as firstName, last_name as lastName, photo_url as photoUrl FROM child WHERE id = ?`,
        [childId]
      );
      if (result) {
        setChildInfo(result);
      }
    } catch (error) {
      console.error('Failed to load child info:', error);
    }
  };

  const getCurrentMonthTitle = () => {
    const now = new Date();
    return `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
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
            <Image 
              source={require('../../assets/images/profile.jpeg')} 
              style={styles.modalProfileImage} 
            />
            {/* 실제 아이 이름 데이터를 사용하세요 */}
            <Text style={styles.modalChildName}>
              {childInfo ? `${childInfo.firstName} ${childInfo.lastName}` : 'Child Name'}
            </Text>
            <Text style={styles.modalActiveLabel}>활성화됨</Text>
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
  modalProfileImage: {
    width: 40,
    height: 40,
    borderRadius: 40,
    marginBottom: 8,
  },
  modalChildName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalActiveLabel: {
    fontSize: 16,
    color: '#007AFF',
    marginBottom: 12,
  },
  addChildButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  addChildButtonText: {
    color: '#FFF',
    fontSize: 16,
  },
});

export default MainScreen;