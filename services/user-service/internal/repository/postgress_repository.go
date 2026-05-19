package repository

import (
    "encoding/json"

    "github.com/google/uuid"
    "github.com/jmoiron/sqlx"
    _ "github.com/lib/pq"
    "github.com/codesbyjit/streamly/platform/services/user-service/internal/models"
)

type PostgresRepository struct {
    db *sqlx.DB
}

func NewPostgresRepository(db *sqlx.DB) *PostgresRepository {
    return &PostgresRepository{db: db}
}

func (r *PostgresRepository) Create(user *models.User) error {
    prefsJSON, _ := json.Marshal(user.Preferences)

    query := `
        INSERT INTO users (id, email, username, display_name, avatar_url, 
                          password_hash, subscription_tier, preferences, created_at, updated_at)
        VALUES (:id, :email, :username, :display_name, :avatar_url,
                :password_hash, :subscription_tier, :preferences, NOW(), NOW())
    `

    _, err := r.db.NamedExec(query, map[string]interface{}{
        "id":               user.ID,
        "email":            user.Email,
        "username":         user.Username,
        "display_name":     user.DisplayName,
        "avatar_url":       user.AvatarURL,
        "password_hash":    user.PasswordHash,
        "subscription_tier": user.SubscriptionTier,
        "preferences":      prefsJSON,
    })
    return err
}

func (r *PostgresRepository) FindByID(id uuid.UUID) (*models.User, error) {
    var user models.User
    err := r.db.Get(&user, "SELECT * FROM users WHERE id = $1", id)
    if err != nil {
        return nil, err
    }
    return &user, nil
}

func (r *PostgresRepository) FindByEmail(email string) (*models.User, error) {
    var user models.User
    err := r.db.Get(&user, "SELECT * FROM users WHERE email = $1", email)
    if err != nil {
        return nil, err
    }
    return &user, nil
}

func (r *PostgresRepository) FindByUsername(username string) (*models.User, error) {
    var user models.User
    err := r.db.Get(&user, "SELECT * FROM users WHERE username = $1", username)
    if err != nil {
        return nil, err
    }
    return &user, nil
}

func (r *PostgresRepository) Update(user *models.User) error {
    prefsJSON, _ := json.Marshal(user.Preferences)

    query := `
        UPDATE users 
        SET display_name = :display_name,
            avatar_url = :avatar_url,
            subscription_tier = :subscription_tier,
            preferences = :preferences,
            updated_at = NOW()
        WHERE id = :id
    `

    _, err := r.db.NamedExec(query, map[string]interface{}{
        "id":               user.ID,
        "display_name":     user.DisplayName,
        "avatar_url":       user.AvatarURL,
        "subscription_tier": user.SubscriptionTier,
        "preferences":      prefsJSON,
    })
    return err
}

func (r *PostgresRepository) Delete(id uuid.UUID) error {
    _, err := r.db.Exec("DELETE FROM users WHERE id = $1", id)
    return err
}
