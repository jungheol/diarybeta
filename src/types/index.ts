export interface Child {
  id: number;
  firstName: string;
  lastName: string;
  birthDate: string;
  photoUrl?: string;
  isActive: number;
  createdAt: string;
}

export interface DiaryEntry {
  id: number;
  childId: number;
  content: string;
  createdAt: string;
  days_since_birth: number;
  thumbnailUri?: string;
}

export interface DiaryImage {
  id: string;
  uri: string;
}

export interface DiaryContent {
  text: string;
  images: DiaryImage[];
}

declare global {
  namespace ReactNavigation {
    interface RootParamList {
      splash: undefined;
      'profile-create': undefined;
      main: { childId: number };
      'diary-write': { childId: number };
    }
  }
}