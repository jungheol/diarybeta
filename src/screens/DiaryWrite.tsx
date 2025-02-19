import React, { useState, useRef } from 'react';
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
  NativeSyntheticEvent,
  TextInputSelectionChangeEventData,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getDBConnection } from '../database/schema';
import { DiaryImage } from '../types';

const DiaryWrite: React.FC = () => {
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const [text, setText] = useState<string>('');
  const [images, setImages] = useState<DiaryImage[]>([]);
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const inputRefs = useRef<TextInput[]>([]);
  const lastFocusedInput = useRef<number>(0);
  const currentDate = new Date();
  const scrollViewRef = useRef<ScrollView>(null);
  const currentInputRef = useRef<TextInput>(null);

  const scrollToCursor = (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    if (currentInputRef.current && scrollViewRef.current) {
      currentInputRef.current.measure((x, y, width, height, pageX, pageY) => {
        const cursorY = pageY + (event.nativeEvent.selection.start / text.length) * height;
        scrollViewRef.current?.scrollTo({
          y: cursorY - Dimensions.get('window').height / 3,
          animated: true,
        });
      });
    }
  };

  const insertImageMarker = (imageId: string, selectionStart: number) => {
    const before = text.slice(0, selectionStart);
    const after = text.slice(selectionStart);
    setText(`${before}\n[IMG:${imageId}]\n${after}`);

    const newPosition = before.length + `\n[IMG:${imageId}]\n`.length;
    setSelection({ start: newPosition, end: newPosition });
    
    // 약간의 지연 후 스크롤 조정
    setTimeout(() => {
      if (currentInputRef.current && scrollViewRef.current) {
        currentInputRef.current.measure((x, y, width, height, pageX, pageY) => {
          scrollViewRef.current?.scrollTo({
            y: pageY + height,
            animated: true,
          });
        });
      }
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
      setTimeout(() => {
        const currentInput = inputRefs.current[lastFocusedInput.current];
        if (currentInput) {
          currentInput.focus();
          insertImageMarker(imageId, selection.start);
        }
      }, 100);
    }
  };

  const removeImage = (imageId: string) => {
    // 텍스트에서 이미지 마커 제거
    const newText = text.replace(new RegExp(`\\n?\\[IMG:${imageId}\\]\\n?`, 'g'), '\n');
    setText(newText.replace(/\n{3,}/g, '\n\n')); // 연속된 줄바꿈 정리

    // 이미지 배열에서 제거
    setImages(images.filter(img => img.id !== imageId));
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

  const renderContent = () => {
    const parts = text.split(/(\[IMG:[^\]]+\])/);
    
    return parts.map((part, index) => {
      const match = part.match(/\[IMG:([^\]]+)\]/);
      if (match) {
        const imageId = match[1];
        const image = images.find(img => img.id === imageId);
        if (image) {
          return (
            <View key={index} style={styles.imageWrapper}>
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
      return (
        <TextInput
          key={index}
          ref={index === parts.length - 1 ? currentInputRef : null}
          style={styles.input}
          multiline
          value={part}
          onChangeText={(newText) => {
            const newParts = [...parts];
            newParts[index] = newText;
            setText(newParts.join(''));
          }}
          onSelectionChange={(event) => {
            setSelection(event.nativeEvent.selection);
            scrollToCursor(event);
          }}
          selection={index === parts.length - 1 ? selection : undefined}
        />
      );
    });
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
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
      >
        <View style={styles.editorContainer}>
          {renderContent()}
        </View>
      </ScrollView>
        
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.addImageButton, images.length >= 10 && styles.addImageButtonDisabled]} 
          onPress={pickImage}
          disabled={images.length >= 10}
        >
          <Text style={styles.addImageButtonText}>사진 추가</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 20,
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
    padding: 16,
  },
  editorContainer: {
    flex: 1,
    padding: 16,
  },
  input: {
    fontSize: 16,
    lineHeight: 24,
    padding: 0,
    textAlignVertical: 'top',
  },
  imageWrapper: {
    position: 'relative',
    marginHorizontal: 8,
    alignItems: 'center',
  },
  image: {  // 해상도에 따른 이미지 사이즈 조절 필요
    width: (Dimensions.get('window').width - 32),
    height: (Dimensions.get('window').width - 32),
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
  buttonContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E1E1E1',
    backgroundColor: '#FFF',
  },
  addImageButton: {
    marginTop: 16,
    marginHorizontal: 16,
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