export interface User {
    id: string;
    email: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    createdAt: Date;
    subscriptionTier: 'free' | 'premium' | 'enterprise';
    preferences: UserPreferences;
}

export interface UserPreferences {
  language: string;
  theme: 'light' | 'dark' | 'system';
  autoplay: boolean;
  notifications: NotificationPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  subscriptions: boolean;
}