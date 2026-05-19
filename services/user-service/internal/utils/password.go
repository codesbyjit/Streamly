package utils

import (
    "golang.org/x/crypto/bcrypt"
)

// HashPassword creates a bcrypt hash from a plain text password
// bcrypt automatically handles salt generation
func HashPassword(password string) (string, error) {
    // Cost of 12 is a good balance between security and speed
    bytes, err := bcrypt.GenerateFromPassword([]byte(password), 12)
    return string(bytes), err
}

// CheckPassword compares a plain text password with a stored hash
func CheckPassword(password, hash string) bool {
    err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
    return err == nil
}