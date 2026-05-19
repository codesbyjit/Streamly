package models

import (
    "time"
    "github.com/google/uuid"
	"encoding/json"
)

type User struct {
    ID               uuid.UUID `db:"id" json:"id"`
    Email            string    `db:"email" json:"email"`
    Username         string    `db:"username" json:"username"`
    DisplayName      string    `db:"display_name" json:"displayName"`
    AvatarURL        *string   `db:"avatar_url" json:"avatarUrl"`
    PasswordHash     string    `db:"password_hash" json:"-"`
    SubscriptionTier string    `db:"subscription_tier" json:"subscriptionTier"`
    Preferences      json.RawMessage `db:"preferences" json:"preferences"`
    CreatedAt        time.Time `db:"created_at" json:"createdAt"`
    UpdatedAt        time.Time `db:"updated_at" json:"updatedAt"`
}

type Preferences struct {
    Language      string                `json:"language"`
    Theme         string                `json:"theme"`
    Autoplay      bool                  `json:"autoplay"`
    Notifications NotificationSettings  `json:"notifications"`
}

type NotificationSettings struct {
    Email         bool `json:"email"`
    Push          bool `json:"push"`
    Subscriptions bool `json:"subscriptions"`
}

type RegisterRequest struct {
    Email       string `json:"email" binding:"required,email"`
    Username    string `json:"username" binding:"required,min=3,max=50"`
    Password    string `json:"password" binding:"required,min=8"`
    DisplayName string `json:"displayName" binding:"required,max=100"`
}

type LoginRequest struct {
    Email    string `json:"email" binding:"required,email"`
    Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
    Token string `json:"token"`
    User  User   `json:"user"`
}