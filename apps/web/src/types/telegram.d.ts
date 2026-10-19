/**
 * Type declarations for the Telegram WebApp SDK (Telegram Mini Apps / TWA).
 */

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramHapticFeedback {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  selectionChanged(): void;
}

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

export interface TelegramMainButton {
  text: string;
  color: string;
  textColor: string;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;
  setText(text: string): this;
  onClick(callback: () => void): this;
  offClick(callback: () => void): this;
  show(): this;
  hide(): this;
  enable(): this;
  disable(): this;
  showProgress(leaveActive?: boolean): this;
  hideProgress(): this;
}

export interface TelegramBackButton {
  isVisible: boolean;
  onClick(callback: () => void): this;
  offClick(callback: () => void): this;
  show(): this;
  hide(): this;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: TelegramUser;
    auth_date?: string;
    hash?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: TelegramThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  BackButton: TelegramBackButton;
  MainButton: TelegramMainButton;
  HapticFeedback: TelegramHapticFeedback;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  ready(): void;
  expand(): void;
  /** Check if Telegram WebApp version is at least the given version (e.g. '7.7'). */
  isVersionAtLeast?(version: string): boolean;
  /** Disable vertical swipe gestures (Mini Apps 7.7+). Older SDKs omit it or warn. */
  disableVerticalSwipes?(): void;
  /** Subscribe to a Telegram WebApp event (e.g. 'themeChanged'). */
  onEvent?(event: string, callback: () => void): void;
  /** Unsubscribe from a Telegram WebApp event. */
  offEvent?(event: string, callback: () => void): void;
  close(): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  showAlert(message: string, callback?: () => void): void;
  showConfirm(message: string, callback?: (ok: boolean) => void): void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}
