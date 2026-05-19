package main

import (
    "log"

    "github.com/gin-gonic/gin"
    "github.com/jmoiron/sqlx"
    _ "github.com/lib/pq"
    "github.com/redis/go-redis/v9"

    "github.com/codesbyjit/streamly/platform/services/user-service/internal/config"
    "github.com/codesbyjit/streamly/platform/services/user-service/internal/handlers"
    "github.com/codesbyjit/streamly/platform/services/user-service/internal/middleware"
    "github.com/codesbyjit/streamly/platform/services/user-service/internal/repository"
    "github.com/codesbyjit/streamly/platform/services/user-service/internal/service"
)

func main() {
    cfg := config.Load()

    db, err := sqlx.Connect("postgres", cfg.DatabaseURL)
    if err != nil {
        log.Fatalf("Failed to connect to database: %v", err)
    }
    defer db.Close()

    if err := db.Ping(); err != nil {
        log.Fatalf("Database ping failed: %v", err)
    }
    log.Println("Connected to PostgreSQL")

    redisClient := redis.NewClient(&redis.Options{
        Addr: cfg.RedisAddr,
    })
    log.Println("Connected to Redis")
    _ = redisClient

    userRepo := repository.NewPostgresRepository(db)
    authService := service.NewAuthService(cfg, userRepo)
    authHandler := handlers.NewAuthHandler(authService)

    router := gin.Default()

    api := router.Group("/api/v1")
    {
        api.POST("/auth/register", authHandler.Register)
        api.POST("/auth/login", authHandler.Login)
    }

    protected := api.Group("/")
    protected.Use(middleware.AuthMiddleware(authService))
    {
        protected.GET("/users/me", func(c *gin.Context) {
            userID, _ := c.Get("userID")
            c.JSON(200, gin.H{"userID": userID})
        })
    }

    router.GET("/health", func(c *gin.Context) {
        c.JSON(200, gin.H{"status": "ok", "service": "user-service"})
    })

    addr := ":" + cfg.ServerPort
    log.Printf("User Service starting on %s", addr)
    if err := router.Run(addr); err != nil {
        log.Fatalf("Failed to start server: %v", err)
    }
}