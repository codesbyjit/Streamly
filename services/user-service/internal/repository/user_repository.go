package repository

import (
    "github.com/google/uuid"
    "github.com/codesbyjit/streamly/platform/services/user-service/internal/models"
)

type UserRepository interface {
    Create(user *models.User) error
    FindByID(id uuid.UUID) (*models.User, error)
    FindByEmail(email string) (*models.User, error)
    FindByUsername(username string) (*models.User, error)
    Update(user *models.User) error
    Delete(id uuid.UUID) error
}
