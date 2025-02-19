import React, { useState, useEffect, useRef } from 'react';
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
  Modal,
  Keyboard,
  KeyboardEvent,
  NativeSyntheticEvent,
  TextInputSelectionChangeEventData,
  TextInputContentSizeChangeEventData,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getDBConnection } from '../database/schema';
import { DiaryImage } from '../types';

const KEYBOARD_MARGIN = 24;
const BUTTON_HEIGHT = 60;
const LINE_HEIGHT = 24;

const DiaryEdit: React.FC = () => {
  const router = useRouter();
  const { diaryId, childId } = useLocalSearchParams<{ diaryId: string; childId: string }>();
  const [text, setText] = useState<string>('');
  const [images, setImages] = useState<DiaryImage[]>([]);
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [createdAt, setCreatedAt] = useState<string>('');
  const [bookmark, setBookmark] = useState<number>(0);
  const [menuModalVisible, setMenuModalVisible] = useState<boolean>(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);
  const lastCursorPositionRef = useRef<number>(0);
  const textInputLayoutRef = useRef<{ y: number; height: number }>({ y: 0, height: 0 });

  useEffect(() => {
    loadDiaryEntry();

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
  }, [diaryId]);

  const loadDiaryEntry = async () => {
    try {
      const db = await getDBConnection();
      const result = await db.getFirstAsync<{ content: string; created_at: string; bookmark: number }>(
        `SELECT content, created_at, bookmark FROM diary_entry WHERE id = ?`,
        [diaryId]
      );

      const imageResults = await db.getAllAsync<{ image_uri: string; image_id: string }>(
        `SELECT image_uri, image_id FROM diary_picture 
          WHERE diary_entry_id = ? 
          ORDER BY created_at ASC`,
        [diaryId]
      );

      if (result) {
        setText(result.content);
        setCreatedAt(result.created_at);
        setBookmark(result.bookmark);
      }

      setImages(imageResults.map(img => ({
        id: img.image_id,
        uri: img.image_uri
      })));
    } catch (error) {
      console.error('Failed to load diary entry:', error);
    }
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
    
    return textInputLayoutRef.current.y + (lineCount * LINE_HEIGHT);
  };

  const adjustScroll = (cursorOffset: number) => {
    if (!scrollViewRef.current || !textInputRef.current) return;

    const visibleHeight = calculateVisibleHeight();
    const cursorY = measureCursorPosition(cursorOffset);
    
    const visibleTop = scrollOffset;
    const visibleBottom = visibleTop + visibleHeight - KEYBOARD_MARGIN - BUTTON_HEIGHT;

    // 커서가 키보드 위 24px에 도달하면 스크롤 시작
    const scrollTriggerPoint = visibleBottom - (LINE_HEIGHT * 2);

    if (cursorY > scrollTriggerPoint) {
      scrollViewRef.current.scrollTo({
        y: cursorY - visibleHeight + KEYBOARD_MARGIN + (LINE_HEIGHT * 2) + BUTTON_HEIGHT,
        animated: true
      });
    } else if (cursorY < visibleTop + KEYBOARD_MARGIN) {
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
    
    requestAnimationFrame(() => {
      adjustScroll(start);
    });
  };

  const handleContentSizeChange = (event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
    const { height } = event.nativeEvent.contentSize;
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

    const newPosition = before.length + imageMarker.length;
    setSelection({ start: newPosition, end: newPosition });
    lastCursorPositionRef.current = newPosition;

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

  const removeImage = (imageId: string) => {
    const newText = text.replace(new RegExp(`\\n?\\[IMG:${imageId}\\]\\n?`, 'g'), '\n');
    setText(newText.replace(/\n{3,}/g, '\n\n'));
    setImages(images.filter(img => img.id !== imageId));
  };

  const handleUpdate = async () => {
    if (!text.trim()) return;

    try {
      const db = await getDBConnection();
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `UPDATE diary_entry SET content = ? WHERE id = ?`,
          [text.trim(), diaryId]
        );

        await db.runAsync(
          `DELETE FROM diary_picture WHERE diary_entry_id = ?`,
          [diaryId]
        );

        for (const image of images) {
          await db.runAsync(
            `INSERT INTO diary_picture (diary_entry_id, image_uri, image_id) VALUES (?, ?, ?)`,
            [diaryId, image.uri, image.id]
          );
        }
      });
      
      router.back();
    } catch (error) {
      console.error('Failed to update diary entry:', error);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      "다이어리 삭제",
      "정말 이 다이어리를 삭제하시겠습니까?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              const db = await getDBConnection();
              await db.runAsync(`DELETE FROM diary_entry WHERE id = ?`, [diaryId]);
              router.back();
            } catch (error) {
              console.error('Failed to delete diary entry:', error);
            }
          },
        },
      ]
    );
  };

  const handleToggleBookmark = async () => {
    try {
      const newBookmark = bookmark === 1 ? 0 : 1;
      const db = await getDBConnection();
      await db.runAsync(
        `UPDATE diary_entry SET bookmark = ? WHERE id = ?`, 
        [newBookmark, diaryId]
      );
      setBookmark(newBookmark);
      setMenuModalVisible(false);
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
    }
  };

  const renderContent = () => {
    const parts = text.split(/(\[IMG:[^\]]+\])/);
    
    return parts.map((part, index) => {
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
        return null;
      }
      return (
        <TextInput
          key={`text-${index}`}
          ref={index === 0 ? textInputRef : null}
          style={styles.input}
          multiline
          value={part}
          onChangeText={(newText) => {
            const newParts = [...parts];
            newParts[index] = newText;
            setText(newParts.join(''));
          }}
          onSelectionChange={handleSelectionChange}
          onContentSizeChange={handleContentSizeChange}
          selection={index === 0 ? selection : undefined}
        />
      );
    });
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
            {new Date(createdAt).toLocaleDateString()} {new Date(createdAt).toLocaleTimeString()}
          </Text>
        </View>
        <View style={styles.buttonsContainer}>
          <TouchableOpacity 
            style={styles.moreButton} 
            onPress={() => setMenuModalVisible(true)}
          >
            <Text style={styles.moreButtonText}>⋮</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, !text.trim() && styles.saveButtonDisabled]}
            onPress={handleUpdate}
            disabled={!text.trim()}
          >
            <Text style={styles.saveButtonText}>✓</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.editorContainer}>
          {renderContent()}
        </View>
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

      <Modal
        visible={menuModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          onPress={() => setMenuModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.modalItem} 
              onPress={handleToggleBookmark}
            >
              <Text style={styles.modalItemText}>
                {bookmark === 1 ? '즐겨찾기 해제' : '즐겨찾기'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.modalItem} 
              onPress={handleDelete}
            >
              <Text style={[styles.modalItemText, { color: '#FF3B30' }]}>
                삭제하기
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.modalCancel} 
              onPress={() => setMenuModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>취소</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  buttonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
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
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: BUTTON_HEIGHT,
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
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
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
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    padding: 20,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  modalItem: {
    paddingVertical: 12,
  },
  modalItemText: {
    fontSize: 18,
    textAlign: 'center',
  },
  modalCancel: {
    marginTop: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E1E1E1',
  },
  modalCancelText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#007AFF',
  },
});

export default DiaryEdit;