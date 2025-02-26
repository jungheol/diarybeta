declare module 'react-native-pell-rich-editor' {
    import React from 'react';
    import { StyleProp, ViewStyle } from 'react-native';
    import { WebViewProps } from 'react-native-webview';
  
    // WebViewProps 확장
    interface ExtendedWebViewProps extends WebViewProps {
      allowFileAccess?: boolean;
      allowingReadAccessToURL?: string;
      allowUniversalAccessFromFileURLs?: boolean;
      mixedContentMode?: 'never' | 'always' | 'compatibility';
    }
  
    export interface RichEditorProps {
      initialContentHTML?: string;
      initialHeight?: number;
      editorStyle?: object;
      style?: StyleProp<ViewStyle>;
      placeholder?: string;
      disabled?: boolean;
      useContainer?: boolean;
      initialFocus?: boolean;
      pasteAsPlainText?: boolean;
      onChange?: (text: string) => void;
      onPaste?: (data: string) => void;
      onMessage?: (data: string) => void;
      webViewProps?: ExtendedWebViewProps;
      // 기타 필요한 속성들
    }
  
    export interface RichToolbarProps {
      getEditor?: () => RichEditor;
      editor?: React.RefObject<RichEditor>;
      actions?: any[];
      selectedIconTint?: string;
      iconTint?: string;
      style?: StyleProp<ViewStyle>;
      // 기타 필요한 속성들
    }
  
    export class RichEditor extends React.Component<RichEditorProps> {
      focusContentEditor(): void;
      blurContentEditor(): void;
      insertImage(url: string, options?: any): void;
      insertHTML(html: string): void;
      getContentHtml(): Promise<string>;
      // 기타 필요한 메서드들
    }
  
    export class RichToolbar extends React.Component<RichToolbarProps> {}
  
    export const actions: {
      setBold: any;
      setItalic: any;
      setUnderline: any;
      heading1: any;
      insertBulletsList: any;
      insertOrderedList: any;
      undo: any;
      redo: any;
      // 기타 필요한 액션들
    };
  }