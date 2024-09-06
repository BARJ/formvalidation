package main

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
)

var sessions = make(map[string]Session)

type Session struct {
	id     string
	userID int
}

func newSession(userID int) (Session, error) {
	for i := 0; i < 10; i++ {
		id, err := generateRandomString(32)
		if err != nil {
			continue // Try again.
		}
		if _, ok := sessions[id]; !ok {
			sessions[id] = Session{id: id, userID: userID}
			return sessions[id], nil
		}
	}
	return Session{}, fmt.Errorf("exhausted all attempts generating unique session ID")
}

func generateRandomString(n int) (string, error) {
	const letters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
	sb := strings.Builder{}
	sb.Grow(n)
	for i := 0; i < n; i++ {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(letters))))
		if err != nil {
			return "", fmt.Errorf("failed to generate random string of length %d", n)
		}
		letter := letters[num.Int64()]
		sb.WriteByte(letter)
	}
	return sb.String(), nil
}
