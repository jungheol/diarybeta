import React, { useState, useRef, useEffect } from 'react';
import * as FileSystem from 'expo-file-system';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Dimensions,
  Keyboard,
  KeyboardEvent,
} from 'react-native';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getDBConnection } from '../database/schema';
import { DiaryImage } from '../types';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { saveImage } from '../services/ImageService';

const BUTTON_HEIGHT = 60; // 사진 추가 버튼의 높이
const KEYBOARD_MARGIN = 8; // 키보드 위 여유 공간

const DiaryWrite: React.FC = () => {
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const [content, setContent] = useState<string>('');
  const [images, setImages] = useState<DiaryImage[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date()); // 현재 날짜로 초기화
  const [isDatePickerVisible, setDatePickerVisible] = useState<boolean>(false);
  
  const richTextRef = useRef<RichEditor>(null);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event: KeyboardEvent) => {
        setKeyboardHeight(event.endCoordinates.height);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  const pickImage = async () => {
    if (images.length >= 10) {
      Alert.alert('알림', '사진은 최대 10장까지만 추가할 수 있습니다.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets[0].uri) {
      // Base64 인코딩을 사용한 이미지 삽입
      try {
        // 고유 이미지 ID 생성
        const imageId = `${Date.now()}`;
        const selectedUri = result.assets[0].uri;
        
        // 이미지를 영구 저장소에 저장
        const savedRelativePath = await saveImage(
          selectedUri, 
          'images', 
          `diary_${imageId}.jpg`
        );
        
        // 이미지 객체 추가 (이제 상대 경로 저장)
        const newImage: DiaryImage = {
          id: imageId,
          uri: savedRelativePath // 상대 경로로 저장
        };
        setImages([...images, newImage]);
        
        // 이미지를 Base64로 인코딩하여 에디터에 표시
        const base64 = await FileSystem.readAsStringAsync(selectedUri, { 
          encoding: FileSystem.EncodingType.Base64 
        });
        const base64Uri = `data:image/jpeg;base64,${base64}`;
        
        // Base64 이미지 삽입 (이미지 뒤에 줄바꿈 추가)
        const imgTag = `<img src="${base64Uri}" data-id="${imageId}" alt="diary image" style="max-width:100%; height:auto; margin:10px 0;" /><br><br>`;
        richTextRef.current?.insertHTML(imgTag);
        
        // 이미지 삽입 후 포커스를 에디터로 되돌림
        setTimeout(() => {
          richTextRef.current?.focusContentEditor();
        }, 500);
      } catch (error) {
        console.error('이미지 처리 오류:', error);
        Alert.alert('오류', '이미지를 추가하는 데 문제가 발생했습니다.');
      }
    }
  };

  // HTML에서 이미지 ID 추출 (data-id 속성 사용)
  const extractImageIds = (html: string): string[] => {
    // data-id 속성 추출 정규식
    const regex = /data-id="([^"]+)"/g;
    const imageIds: string[] = [];
    let match;
    
    console.log('HTML 추출 시작 (처음 100자):', html.substring(0, 100) + '...');
    
    while ((match = regex.exec(html)) !== null) {
      const id = match[1];
      console.log('추출된 이미지 ID:', id);
      imageIds.push(id);
    }
    
    console.log('추출된 모든 이미지 ID:', imageIds);
    return imageIds;
  };

  const showDatePicker = () => {
    setDatePickerVisible(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisible(false);
  };

  const handleConfirm = (date: Date) => {
    setSelectedDate(date);
    hideDatePicker();
  };

  const handleSave = async () => {
    if (!content.trim()) return;

    try {
      // 현재 HTML에서 사용된 이미지 ID 추출
      const usedImageIds = extractImageIds(content);
      
      // 실제로 사용된 이미지만 필터링
      const usedImages = images.filter(img => usedImageIds.includes(img.id));
      
      const db = await getDBConnection();
      await db.withTransactionAsync(async () => {
        const diaryResult = await db.runAsync(
          `INSERT INTO diary_entry (child_id, content, created_at) VALUES (?, ?, ?)`,
          [childId, content.trim(), selectedDate.toISOString()] // 선택된 날짜 사용
        );
        
        const diaryId = diaryResult.lastInsertRowId;
        
        for (const image of usedImages) {
          await db.runAsync(
            `INSERT INTO diary_picture (diary_entry_id, image_uri, image_id) VALUES (?, ?, ?)`,
            [diaryId, image.uri, image.id]
          );
        }
      });
      
      router.back();
    } catch (error) {
      console.error('Failed to save diary entry:', error);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>◀</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={showDatePicker}>
            <Text style={styles.date}>
              {selectedDate.toLocaleDateString()} {selectedDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              <Text style={styles.editDateIcon}> ✎</Text>
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, !content.trim() && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!content.trim()}
        >
          <Text style={styles.saveButtonText}>✓</Text>
        </TouchableOpacity>
      </View>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="datetime"
        onConfirm={handleConfirm}
        onCancel={hideDatePicker}
        date={selectedDate}
        confirmTextIOS="확인"
        cancelTextIOS="취소"
        display='inline'
      />
      
      {/* 리치 텍스트 에디터 - 기본 설정만 사용 */}
      <RichEditor
        ref={richTextRef}
        initialContentHTML=""
        onChange={setContent}
        placeholder="일기를 작성하세요..."
        initialHeight={Dimensions.get('window').height - 120}
        editorStyle={{
          backgroundColor: '#FFFFFF',
          contentCSSText: `
            font-family: system-ui;
            font-size: 16px;
            padding: 12px;
            line-height: 1.5;
          `
        }}
        style={styles.editor}
        useContainer={true}
        initialFocus={true}
        pasteAsPlainText={true}
        onPaste={(data) => {
          console.log('붙여넣기 이벤트:', data);
        }}
      />

      {keyboardHeight > 0 && (
        <View style={[styles.bottomBar, { bottom: keyboardHeight }]}>
          <TouchableOpacity 
            style={[styles.addImageButton, images.length >= 10 && styles.addImageButtonDisabled]} 
            onPress={pickImage}
            disabled={images.length >= 10}
          >
            <Text style={styles.addImageButtonText}>사진 추가</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 60,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    fontSize: 24,
    color: '#666',
  },
  date: {
    fontSize: 16,
    color: '#666',
  },
  editDateIcon: {
    fontSize: 14,
    color: '#007AFF',
  },
  saveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#E1E1E1',
  },
  saveButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  editor: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BUTTON_HEIGHT,
    borderTopWidth: 1,
    borderTopColor: '#E1E1E1',
    backgroundColor: '#f8f8f8',
    padding: 8,
    justifyContent: 'center',
  },
  addImageButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  addImageButtonDisabled: {
    backgroundColor: '#E1E1E1',
  },
  addImageButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: 'bold',
  },
});

export default DiaryWrite;