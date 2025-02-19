import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
  Dimensions,
  Keyboard,
  KeyboardEvent,
  LayoutChangeEvent,
  NativeSyntheticEvent,
  TextInputSelectionChangeEventData,
  TextInputContentSizeChangeEventData,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getDBConnection } from '../database/schema';
import { DiaryImage } from '../types';

const KEYBOARD_MARGIN = 24; // 키보드 위 여유 공간
const BUTTON_HEIGHT = 60; // 사진 추가 버튼의 높이
const LINE_HEIGHT = 24; // TextInput의 라인 높이

const DiaryWrite: React.FC = () => {
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const [text, setText] = useState<string>('');
  const [images, setImages] = useState<DiaryImage[]>([]);
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const currentDate = new Date();
  
  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);
  const lastCursorPositionRef = useRef<number>(0);
  const textInputLayoutRef = useRef<{ y: number; height: number }>({ y: 0, height: 0 });
  const [scrollOffset, setScrollOffset] = useState(0);

  
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

  const onTextInputLayout = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    textInputLayoutRef.current = { y, height };
  };

  const calculateVisibleHeight = () => {
    const screenHeight = Dimensions.get('window').height;
    const totalBottomHeight = keyboardHeight + (keyboardHeight > 0 ? BUTTON_HEIGHT : 0);
    return screenHeight - totalBottomHeight;
  };

  const measureCursorPosition = (cursorOffset: number) => {
    if (!textInputRef.current) return 0;

    const textContent = text.slice(0, cursorOffset);
    const lines = textContent.split('\n');
    const lineCount = lines.length;
    
    // 현재 커서의 Y 위치 계산
    return textInputLayoutRef.current.y + (lineCount * LINE_HEIGHT);
  };

  const adjustScroll = (cursorOffset: number) => {
    if (!scrollViewRef.current || !textInputRef.current) return;

    const visibleHeight = calculateVisibleHeight();
    const cursorY = measureCursorPosition(cursorOffset);
    
    // 화면에 보이는 영역의 상단과 하단 Y 좌표
    const visibleTop = scrollOffset;
    const visibleBottom = visibleTop + visibleHeight - KEYBOARD_MARGIN - BUTTON_HEIGHT;

    const scrollTriggerPoint = visibleBottom - (LINE_HEIGHT * 2);

    console.log("cursorY.     " + cursorY);
    console.log("scrollTriggerPoint       " + scrollTriggerPoint );
    if (cursorY > scrollTriggerPoint) {
      // 커서가 화면 하단을 벗어났을 때
      scrollViewRef.current.scrollTo({
        y: cursorY - visibleHeight + KEYBOARD_MARGIN + (LINE_HEIGHT * 2) + BUTTON_HEIGHT,
        animated: true
      });
    } else if (cursorY < visibleTop + KEYBOARD_MARGIN) {
      // 커서가 화면 상단을 벗어났을 때
      scrollViewRef.current.scrollTo({
        y: Math.max(0, cursorY - KEYBOARD_MARGIN - LINE_HEIGHT),
        animated: true
      });
    }
  };

  const handleSelectionChange = (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    const { start, end } = event.nativeEvent.selection;
    setSelection({ start, end });
    lastCursorPositionRef.current = start;
    
    // 커서 위치가 변경될 때마다 스크롤 조정
    requestAnimationFrame(() => {
      adjustScroll(start);
    });
  };

  const handleContentSizeChange = (event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
    const { width, height } = event.nativeEvent.contentSize;
    textInputLayoutRef.current.height = height;
  };

  const handleScroll = (event: NativeSyntheticEvent<any>) => {
    setScrollOffset(event.nativeEvent.contentOffset.y);
  };

  const insertImageMarker = (imageId: string) => {
    const cursorPosition = lastCursorPositionRef.current;
    const before = text.slice(0, cursorPosition);
    const after = text.slice(cursorPosition);
    const imageMarker = `\n[IMG:${imageId}]\n`;
    const newText = `${before}${imageMarker}${after}`;
    setText(newText);

    // 이미지 마커 삽입 후 커서 위치 조정
    const newPosition = before.length + imageMarker.length;
    setSelection({ start: newPosition, end: newPosition });
    lastCursorPositionRef.current = newPosition;

    // 새로운 커서 위치로 스크롤 조정
    setTimeout(() => {
      adjustScroll(newPosition);
    }, 100);
  };

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
      const imageId = `${Date.now()}`;
      const newImage: DiaryImage = {
        id: imageId,
        uri: result.assets[0].uri
      };
      
      setImages([...images, newImage]);
      insertImageMarker(imageId);
    }
  };

  const handleSave = async () => {
    if (!text.trim()) return;

    try {
      const db = await getDBConnection();
      await db.withTransactionAsync(async () => {
        const diaryResult = await db.runAsync(
          `INSERT INTO diary_entry (child_id, content) VALUES (?, ?)`,
          [childId, text.trim()]
        );
        
        const diaryId = diaryResult.lastInsertRowId;
        
        for (const image of images) {
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

  const removeImage = (imageId: string) => {
    const newText = text.replace(new RegExp(`\\n?\\[IMG:${imageId}\\]\\n?`, 'g'), '\n')
                      .replace(/\n{3,}/g, '\n\n');
    setText(newText);
    setImages(images.filter(img => img.id !== imageId));
  };

  const renderContent = () => {
    const parts = text.split(/(\[IMG:[^\]]+\])/);
    const elements = parts.map((part, index) => {
      const match = part.match(/\[IMG:([^\]]+)\]/);
      if (match) {
        const imageId = match[1];
        const image = images.find(img => img.id === imageId);
        if (image) {
          return (
            <View key={`img-${index}`} style={styles.imageWrapper}>
              <Image source={{ uri: image.uri }} style={styles.image} />
              <TouchableOpacity 
                style={styles.removeButtonContainer}
                onPress={() => removeImage(image.id)}
              >
                <Text style={styles.removeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
          );
        }
      }
      return null;
    });

    return (
      <View style={styles.editorContainer}>
        <TextInput
          ref={textInputRef}
          style={styles.input}
          multiline
          value={text}
          onChangeText={setText}
          onSelectionChange={handleSelectionChange}
          onContentSizeChange={handleContentSizeChange}
          onLayout={(e) => {
            textInputLayoutRef.current = {
              y: e.nativeEvent.layout.y,
              height: e.nativeEvent.layout.height
            };
          }}
          selection={selection}
        />
        {elements}
      </View>
    );
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
          <Text style={styles.date}>
            {currentDate.toLocaleDateString()} {currentDate.toLocaleTimeString()}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, !text.trim() && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!text.trim()}
        >
          <Text style={styles.saveButtonText}>✓</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        ref={scrollViewRef}
        style={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollBeginDrag={() => {
          // 사용자가 직접 스크롤할 때 자동 스크롤 조정 일시 중지
          textInputRef.current?.blur();
        }}
      >
        {renderContent()}
      </ScrollView>

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
  contentContainer: {
    flex: 1,
  },
  editorContainer: {
    flex: 1,
    padding: 16,
    paddingBottom: BUTTON_HEIGHT + 16,
  },
  input: {
    fontSize: 16,
    lineHeight: LINE_HEIGHT,
    padding: 0,
    textAlignVertical: 'top',
  },
  imageWrapper: {
    marginVertical: 8,
    alignItems: 'center',
  },
  image: {
    width: Dimensions.get('window').width - 32,
    height: Dimensions.get('window').width - 32,
    borderRadius: 8,
  },
  removeButtonContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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