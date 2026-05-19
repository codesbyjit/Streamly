package config

import (
    "os"
    "strconv"
    "time"
	
	"github.com/joho/godotenv"
)

type Config struct {
    ServerPort     string
    DatabaseURL    string
    RedisAddr      string
    JWTSecret      string
    JWTExpiry      time.Duration
    Environment    string
}

func Load() *Config {
	_ = godotenv.Load()

    return &Config{
        ServerPort:  getEnv("SERVER_PORT", "8081"),
        DatabaseURL: getEnv("DATABASE_URL", "postgres://streamly:dev_password_123@localhost:5432/streamly?sslmode=disable"),
        RedisAddr:   getEnv("REDIS_ADDR", "localhost:6379"),
        JWTSecret:   getEnv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production"),
        JWTExpiry:   getDurationEnv("JWT_EXPIRY_HOURS", 24*7),
        Environment: getEnv("ENVIRONMENT", "development"),
    }
}

func getEnv(key, defaultValue string) string {
    if value := os.Getenv(key); value != "" {
        return value
    }
    return defaultValue
}

func getDurationEnv(key string, defaultHours int) time.Duration {
    if value := os.Getenv(key); value != "" {
        if hours, err := strconv.Atoi(value); err == nil {
            return time.Duration(hours) * time.Hour
        }
    }
    return time.Duration(defaultHours) * time.Hour
}