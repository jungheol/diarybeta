import React, { useEffect, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { createTables, getDBConnection } from '../database/schema';

const Splash: React.FC = () => {
  const router = useRouter();
  const fadeAnim = new Animated.Value(0);
  const [isDBInitialized, setIsDBInitialized] = useState(false);

  // 데이터베이스 초기화 함수
  const initializeDatabase = async () => {
    try {
      const db = getDBConnection();
      await createTables(db);
      setIsDBInitialized(true);
    } catch (error) {
      console.error('Error initializing database:', error);
    }
  };

  // child 테이블 데이터 확인 함수
  const getActiveChildId = async (): Promise<number | null> => {
    try {
      const db = getDBConnection();
      // is_active가 1인 child를 찾아서 첫번째 row의 id를 반환합니다.
      const result = await db.getAllAsync<{ id: number }>(
        'SELECT id FROM child WHERE is_active = 1 LIMIT 1'
      );

      // 만약 getAllAsync가 배열을 바로 반환한다면
      if (result.length > 0) {
        return result[0].id;
      }

      // 만약 결과가 expo-sqlite의 형식이라면 아래와 같이 _array를 사용합니다.
      // const entries = result.rows._array;
      // return entries.length > 0 ? entries[0].id : null;

      return null;
    } catch (error) {
      console.error('Error checking child table:', error);
      return null;
    }
  };

  useEffect(() => {
    initializeDatabase();
  }, []);

  useEffect(() => {
    if (!isDBInitialized) return;
  
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 1000,
        delay: 1000,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      const activeChildId = await getActiveChildId();
      if (activeChildId) {
        // activeChildId가 있을 경우, MainScreen으로 childId 파라미터와 함께 이동
        router.replace({
          pathname: '/main',
          params: { childId: activeChildId.toString() },
        });
      } else {
        // activeChildId가 없으면 프로필 생성 화면으로 이동
        router.replace('/profile-create');
      }
    });
  }, [isDBInitialized]);

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require('../../assets/images/app-icon.png')}
        style={[
          styles.logo,
          {
            opacity: fadeAnim,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
  },
});

export default Splash;