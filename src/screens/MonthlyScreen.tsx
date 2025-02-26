import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getDBConnection } from '../database/schema';

interface MonthlyData {
  yearMonth: string;  // "2025-02" 형식
  count: number;
  displayText: string;  // "2025년 2월" 형식
}

const MonthlyScreen: React.FC = () => {
  const router = useRouter();
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [activeChildId, setActiveChildId] = useState<number | null>(null);

  const loadActiveChild = async () => {
    try {
      const db = await getDBConnection();
      const result = await db.getAllAsync<{ id: number, isActive: number }>(
        `SELECT id, is_active as isActive FROM child`
      );
      const active = result.find(child => child.isActive === 1);
      if (active) {
        setActiveChildId(active.id);
      }
    } catch (error) {
      console.error('Failed to load child info:', error);
    }
  };

  const loadMonthlyData = async () => {
    if (!activeChildId) return;

    try {
      const db = await getDBConnection();
      const results = await db.getAllAsync<{ yearMonth: string; count: number }>(
        `SELECT 
          strftime('%Y-%m', created_at) as yearMonth,
          COUNT(*) as count
         FROM diary_entry
         WHERE child_id = ?
         GROUP BY yearMonth
         ORDER BY yearMonth DESC`,
        [activeChildId]
      );

      const formattedData = results.map(item => {
        const [year, month] = item.yearMonth.split('-');
        return {
          yearMonth: item.yearMonth,
          count: item.count,
          displayText: `${year}년 ${parseInt(month)}월`
        };
      });

      setMonthlyData(formattedData);
    } catch (error) {
      console.error('Failed to load monthly data:', error);
    }
  };

  useEffect(() => {
    loadActiveChild();
  }, []);

  useEffect(() => {
    if (activeChildId) {
      loadMonthlyData();
    }
  }, [activeChildId]);

  const handleMonthSelect = (yearMonth: string) => {
    // 새로운 MonthlyDetailScreen으로 이동하도록 변경
    router.push({
      pathname: '/monthly-detail',
      params: { 
        yearMonth, 
        childId: activeChildId?.toString() 
      }
    });
  };

  const renderMonthItem = ({ item }: { item: MonthlyData }) => (
    <TouchableOpacity
      style={styles.monthItem}
      onPress={() => handleMonthSelect(item.yearMonth)}
    >
      <Text style={styles.monthText}>{item.displayText}</Text>
      <View style={styles.rightContainer}>
        <Text style={styles.countText}>{item.count}</Text>
        <Text style={styles.arrowText}>{'>'}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>◀</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>월별보기</Text>
      </View>

      <FlatList
        data={monthlyData}
        renderItem={renderMonthItem}
        keyExtractor={item => item.yearMonth}
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
    color: '#666',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 16,
  },
  monthItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '500',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countText: {
    fontSize: 16,
    color: '#666',
  },
  arrowText: {
    fontSize: 18,
    color: '#666',
  },
});

export default MonthlyScreen;