package service

import (
	"encoding/json"
    "errors"
    "time"

    "github.com/golang-jwt/jwt/v5"
    "github.com/google/uuid"
    "github.com/codesbyjit/streamly/platform/services/user-service/internal/config"
    "github.com/codesbyjit/streamly/platform/services/user-service/internal/models"
    "github.com/codesbyjit/streamly/platform/services/user-service/internal/repository"
    "github.com/codesbyjit/streamly/platform/services/user-service/internal/utils"
)

type AuthService struct {
    config     *config.Config
    userRepo   repository.UserRepository
}

func NewAuthService(cfg *config.Config, repo repository.UserRepository) *AuthService {
    return &AuthService{
        config:   cfg,
        userRepo: repo,
    }
}

func (s *AuthService) Register(req models.RegisterRequest) (*models.AuthResponse, error) {
    // Check if email exists
    existing, _ := s.userRepo.FindByEmail(req.Email)
    if existing != nil {
        return nil, errors.New("email already registered")
    }

    // Check if username exists
    existing, _ = s.userRepo.FindByUsername(req.Username)
    if existing != nil {
        return nil, errors.New("username already taken")
    }

    // Hash password
    hash, err := utils.HashPassword(req.Password)
    if err != nil {
        return nil, err
    }

    // Create user (channel auto-created by DB trigger)
    user := &models.User{
        ID:          uuid.New(),
        Email:       req.Email,
        Username:    req.Username,
        DisplayName: req.DisplayName,
        PasswordHash: hash,
        SubscriptionTier: "free",
        Preferences: json.RawMessage(`{
    		"language":"en",
    		"theme":"system",
    		"autoplay":true,
    		"notifications":{
        	"email":true,
        	"push":true,
        	"subscriptions":true
    	}
	}`),
    }

    if err := s.userRepo.Create(user); err != nil {
        return nil, err
    }

    // Generate token
    token, err := s.generateToken(user.ID)
    if err != nil {
        return nil, err
    }

    return &models.AuthResponse{
        Token: token,
        User:  *user,
    }, nil
}

func (s *AuthService) Login(req models.LoginRequest) (*models.AuthResponse, error) {
    user, err := s.userRepo.FindByEmail(req.Email)
    if err != nil {
        return nil, errors.New("invalid credentials")
    }

    if !utils.CheckPassword(req.Password, user.PasswordHash) {
        return nil, errors.New("invalid credentials")
    }

    token, err := s.generateToken(user.ID)
    if err != nil {
        return nil, err
    }

    return &models.AuthResponse{
        Token: token,
        User:  *user,
    }, nil
}

func (s *AuthService) generateToken(userID uuid.UUID) (string, error) {
    claims := jwt.MapClaims{
        "sub": userID.String(),
        "iat": time.Now().Unix(),
        "exp": time.Now().Add(s.config.JWTExpiry).Unix(),
        "type": "access",
    }

    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString([]byte(s.config.JWTSecret))
}

func (s *AuthService) ValidateToken(tokenString string) (uuid.UUID, error) {
    token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, errors.New("unexpected signing method")
        }
        return []byte(s.config.JWTSecret), nil
    })

    if err != nil {
        return uuid.Nil, err
    }

    if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
        userID, err := uuid.Parse(claims["sub"].(string))
        if err != nil {
            return uuid.Nil, err
        }
        return userID, nil
    }

    return uuid.Nil, errors.New("invalid token")
}