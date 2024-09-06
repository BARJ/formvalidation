package main

import "context"

type User struct {
	id        int
	email     string
	firstname string
	surname   string
	password  string // Plaintext, not secure but for the sake of demonstration.
}

func (u User) isAnonymous() bool {
	return u == (User{})
}

var users = []User{
	{id: 1, email: "john.doe@fakemail.com", firstname: "John", surname: "Doe", password: "pxr0u4hZ"},
	{id: 2, email: "jane.doe@fakemail.com", firstname: "Jane", surname: "Doe", password: "8p3qzh6w"},
}

type key int

var userKey key

func contextWithUser(ctx context.Context, u User) context.Context {
	return context.WithValue(ctx, userKey, u)
}

func userFromContext(ctx context.Context) (User, bool) {
	u, ok := ctx.Value(userKey).(User)
	return u, ok
}
