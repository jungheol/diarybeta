import React, { useState, useEffect, useRef } from 'react';
import * as FileSystem from 'expo-file-system';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  Modal,
  Keyboard,
  KeyboardEvent,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getDBConnection } from '../database/schema';
import { DiaryImage } from '../types';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';

const BUTTON_HEIGHT = 60; // 사진 추가 버튼의 높이
const KEYBOARD_MARGIN = 8; // 키보드 위 여유 공간

const DiaryEdit: React.FC = () => {
  const router = useRouter();
  const { diaryId, childId } = useLocalSearchParams<{ diaryId: string; childId: string }>();
  const [content, setContent] = useState<string>('');
  const [images, setImages] = useState<DiaryImage[]>([]);
  const [createdAt, setCreatedAt] = useState<string>('');
  const [bookmark, setBookmark] = useState<number>(0);
  const [menuModalVisible, setMenuModalVisible] = useState<boolean>(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  const richTextRef = useRef<RichEditor>(null);

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
        // 기존 텍스트 및 이미지 마커 형식에서 HTML 형식으로 변환
        const htmlContent = await convertToHtml(result.content, imageResults);
        setContent(htmlContent);
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

  // 기존 텍스트 형식([IMG:id])에서 HTML 형식으로 변환
  const convertToHtml = async (text: string, imageData: { image_uri: string; image_id: string }[]) => {
    const parts = text.split(/(\[IMG:[^\]]+\])/);
    let htmlContent = '';

    for (const part of parts) {
      const match = part.match(/\[IMG:([^\]]+)\]/);
      if (match) {
        const imageId = match[1];
        const image = imageData.find(img => img.image_id === imageId);
        if (image) {
          try {
            // 이미지를 Base64로 인코딩
            const base64 = await FileSystem.readAsStringAsync(image.image_uri, { 
              encoding: FileSystem.EncodingType.Base64 
            });
            const base64Uri = `data:image/jpeg;base64,${base64}`;
            
            // 이미지 태그 추가
            htmlContent += `<img src="${base64Uri}" data-id="${imageId}" alt="diary image" style="max-width:100%; height:auto; margin:10px 0;" /><br>`;
          } catch (error) {
            console.error('이미지 로드 오류:', error);
          }
        }
      } else {
        // 일반 텍스트는 그대로 추가하되, 줄바꿈 처리
        htmlContent += part.replace(/\n/g, '<br>');
      }
    }

    return htmlContent;
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
        
        // Base64 인코딩을 사용한 이미지 삽입
        try {
          // 이미지를 Base64로 인코딩
          const imageUri = result.assets[0].uri;
          console.log('이미지 URI:', imageUri);
          
          const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
          const base64Uri = `data:image/jpeg;base64,${base64}`;
          
          // 이미지 객체 추가
          const imageId = `${Date.now()}`;
          const newImage: DiaryImage = {
            id: imageId,
            uri: imageUri
          };
          setImages([...images, newImage]);
          
          // Base64 이미지 삽입 (이미지 뒤에 줄바꿈 추가)
          const imgTag = `<img src="${base64Uri}" data-id="${imageId}" alt="diary image" style="max-width:100%; height:auto; margin:10px 0;" /><br><br>`;
          richTextRef.current?.insertHTML(imgTag);
          
          console.log('이미지 Base64 삽입 완료 (길이):', base64.length);
          
          // 이미지 삽입 후 포커스를 에디터로 되돌림
          setTimeout(() => {
            richTextRef.current?.focusContentEditor();
          }, 500); // 시간을 조금 더 늘려 에디터가 렌더링될 시간 확보
        } catch (error) {
          console.error('이미지 Base64 변환 오류:', error);
          Alert.alert('오류', '이미지를 추가하는 데 문제가 발생했습니다.');
        }
      }
    };

  const handleUpdate = async () => {
    if (!content.trim()) return;

    try {
      // 현재 HTML에서 사용된 이미지 ID 추출
      const usedImageIds = extractImageIds(content);
      
      // 실제로 사용된 이미지만 필터링
      const usedImages = images.filter(img => usedImageIds.includes(img.id));
      
      const db = await getDBConnection();
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `UPDATE diary_entry SET content = ? WHERE id = ?`,
          [content.trim(), diaryId]
        );

        await db.runAsync(
          `DELETE FROM diary_picture WHERE diary_entry_id = ?`,
          [diaryId]
        );

        for (const image of usedImages) {
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
            style={[styles.saveButton, !content.trim() && styles.saveButtonDisabled]}
            onPress={handleUpdate}
            disabled={!content.trim()}
          >
            <Text style={styles.saveButtonText}>✓</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* 리치 텍스트 에디터 */}
      <RichEditor
        ref={richTextRef}
        initialContentHTML={content}
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
        pasteAsPlainText={true}
        onPaste={(data) => {
          console.log('붙여넣기 이벤트:', data);
        }}
      />

      {keyboardHeight > 0 && (
        <View style={[
          styles.bottomBar, 
          { 
            bottom: keyboardHeight,
            // 버튼을 약간 위로 올리기
            transform: [{ translateY: -4 }]
          }
        ]}>
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