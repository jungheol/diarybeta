import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { getDBConnection, initializeApp } from '../database/schema';

SplashScreen.preventAutoHideAsync();

const Splash: React.FC = () => {
  const router = useRouter();
  const fadeAnim = new Animated.Value(0);
  const [isDBInitialized, setIsDBInitialized] = useState(false);
  const [isSplashHidden, setIsSplashHidden] = useState(false);

  // 데이터베이스 초기화 함수
  const initializeDatabase = async () => {
    try {
      await initializeApp();
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
    const handleSplashAnimation = async () => {
      try {
        // 커스텀 애니메이션 시작
        await new Promise((resolve) => {
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
          ]).start(resolve);
        });

        // 네이티브 스플래시 스크린 숨기기
        await SplashScreen.hideAsync();
        setIsSplashHidden(true);

        // 라우팅 처리
        const activeChildId = await getActiveChildId();
        if (activeChildId) {
          router.replace({
            pathname: '/main',
            params: { childId: activeChildId.toString() },
          });
        } else {
          router.replace('/profile-create');
        }
      } catch (error) {
        console.error('Error during splash animation:', error);
        setIsSplashHidden(true);
      }
    };

    handleSplashAnimation();
  }, [isDBInitialized]);

  useEffect(() => {
    if (!isSplashHidden) return;
    
    // 애니메이션 및 라우팅 코드...
  }, [isSplashHidden, fadeAnim, router]);

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require('../../assets/images/splash-icon.png')}
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
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    resizeMode: 'contain',
  },
});

export default Splash;