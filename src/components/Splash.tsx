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
  const checkChildInfo = async (): Promise<boolean> => {
    try {
      const db = getDBConnection();
      const result = await db.getAllAsync<{ id: number }>(
        'SELECT id FROM child LIMIT 1'
      );
      console.log(result.length);
      return result.length > 0;
    } catch (error) {
      console.error('Error checking child table:', error);
      return false;
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
      const hasChild = await checkChildInfo();
      router.replace(hasChild ? '/main' : '/profile-create');
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