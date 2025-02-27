import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { getImageUri } from '../services/ImageService';

interface DiaryThumbnailProps {
  thumbnailUri: string | null;
}

const DiaryThumbnail: React.FC<DiaryThumbnailProps> = ({ thumbnailUri }) => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  useEffect(() => {
    const loadImage = async () => {
      if (thumbnailUri) {
        try {
          const uri = await getImageUri(thumbnailUri, null);
          setImageUri(uri);
        } catch (error) {
          console.error('Error loading thumbnail:', error);
          setImageUri(null);
        }
      } else {
        setImageUri(null);
      }
      setIsLoading(false);
    };
    
    loadImage();
  }, [thumbnailUri]);
  
  if (isLoading || !imageUri) {
    return null;
  }
  
  return (
    <View style={styles.thumbnailContainer}>
      <Image 
        source={{ uri: imageUri }} 
        style={styles.thumbnailImage}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  thumbnailContainer: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 40,
    height: 40,
  },
  thumbnailImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
  },
});

export default DiaryThumbnail;