package main

import (
	"bytes"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"net/mail"
	"regexp"
	"slices"
	"strconv"
)

type SiteData struct {
	Title       string
	CurrentUser UserData
	FormError   map[string]string
}

type UserData struct {
	ID        int    `json:"id"`
	Email     string `json:"email"`
	Firstname string `json:"firstname"`
	Surname   string `json:"surname"`
}

func parseUserData(user User) UserData {
	return UserData{
		ID:        user.id,
		Email:     user.email,
		Firstname: user.firstname,
		Surname:   user.surname,
	}
}

type SiteError struct {
	err  error
	code int
}

func (e SiteError) Error() string {
	return fmt.Sprintf("code %d: %v", e.code, e.err)
}

func (e SiteError) Unwrap() error {
	return e.err
}

func parseSiteError(err error) SiteError {
	var siteErr SiteError
	if errors.As(err, &siteErr) {
		if http.StatusText(siteErr.code) == "" {
			siteErr.code = http.StatusInternalServerError
		}
	} else {
		siteErr = SiteError{err, http.StatusInternalServerError}
	}
	return siteErr
}

//go:embed content
var content embed.FS

var siteTmpl = template.Must(template.ParseFS(content, "content/html/site.tmpl.html"))
var signUpTmpl = template.Must(template.Must(siteTmpl.Clone()).ParseFS(content, "content/html/sign-up.tmpl.html"))
var signInTmpl = template.Must(template.Must(siteTmpl.Clone()).ParseFS(content, "content/html/sign-in.tmpl.html"))
var userProfileTmpl = template.Must(template.Must(siteTmpl.Clone()).ParseFS(content, "content/html/user-profile.tmpl.html"))

func registerSite(mux *http.ServeMux) {
	mux.Handle("GET /content/css/", http.FileServerFS(content))
	mux.Handle("GET /content/js/", http.FileServerFS(content))
	mux.HandleFunc("/", makeHandler(homeHandler))
	mux.HandleFunc("GET /users/sign-up", makeHandler(signUpHandler))
	mux.HandleFunc("POST /users/sign-up", makeHandler(signUpHandler))
	mux.HandleFunc("GET /users/sign-in", makeHandler(signInHandler))
	mux.HandleFunc("POST /users/sign-in", makeHandler(signInHandler))
	mux.HandleFunc("POST /users/sign-out", makeHandler(signOutHandler))
	mux.HandleFunc("GET /users/{id}", makeHandler(userProfileHandler))
	mux.HandleFunc("GET /users", listUsers)
}

func listUsers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userDataList := slices.Collect(func(yield func(user UserData) bool) {
		for _, u := range users {
			if u.email == r.FormValue("email") {
				if !yield(parseUserData(u)) {
					return
				}
			}
		}
	})
	if userDataList == nil {
		userDataList = []UserData{}
	}
	json.NewEncoder(w).Encode(struct {
		Users []UserData `json:"users"`
	}{Users: userDataList})
}

func homeHandler(w http.ResponseWriter, r *http.Request) error {
	// If signed in redirect to user profile page otherwise redirect to sign-in page.
	if user, ok := userFromContext(r.Context()); ok {
		http.Redirect(w, r, fmt.Sprintf("/users/%d", user.id), http.StatusSeeOther)
	} else {
		http.Redirect(w, r, "/users/sign-in", http.StatusSeeOther)
	}
	return nil
}

func userProfileHandler(w http.ResponseWriter, r *http.Request) error {
	currentUser, _ := userFromContext(r.Context())

	// Parse user ID.
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return SiteError{fmt.Errorf("invalid ID %q: %v", r.PathValue("id"), err), http.StatusNotFound}
	}

	// Find queried user.
	i := slices.IndexFunc(users, func(u User) bool { return u.id == id })
	if i == -1 {
		return SiteError{fmt.Errorf("user with ID %q does not exist", r.PathValue("id")), http.StatusNotFound}
	}
	user := users[i]

	return serveTemplate(w, userProfileTmpl, struct {
		SiteData
		User UserData
	}{
		SiteData: SiteData{
			Title:       fmt.Sprintf(`User: "%s %s"`, user.firstname, user.surname),
			CurrentUser: parseUserData(currentUser),
		},
		User: parseUserData(user),
	})
}

func signInHandler(w http.ResponseWriter, r *http.Request) error {
	data := SiteData{Title: "Sign In", FormError: make(map[string]string)}

	if r.Method == http.MethodGet {
		// Redirect to user profile if already signed in.
		if user, ok := userFromContext(r.Context()); ok {
			http.Redirect(w, r, fmt.Sprintf("/users/%d", user.id), http.StatusSeeOther)
			return nil
		}
		// Serve sign-in page.
		return serveTemplate(w, signInTmpl, data)
	}

	// Validate email and password.
	if r.FormValue("email") == "" {
		data.FormError["email"] = "Require email."
	} else if _, err := mail.ParseAddress(r.FormValue("email")); err != nil {
		data.FormError["email"] = "Invalid email."
	}
	if r.FormValue("password") == "" {
		data.FormError["password"] = "Require password."
	}
	if len(data.FormError) > 0 {
		return serveTemplate(w, signInTmpl, data)
	}

	// Get queried user.
	var user User
	if i := slices.IndexFunc(users, func(u User) bool { return u.email == r.FormValue("email") }); i != -1 && users[i].password == r.FormValue("password") {
		user = users[i]
	}

	// Validate user credentials.
	if user.isAnonymous() || user.password != r.FormValue("password") {
		data.FormError["email"] = "The email or password is incorrect."
		return serveTemplate(w, signInTmpl, data)
	}

	// Set session cookie.
	if session, err := newSession(user.id); err != nil {
		return fmt.Errorf("failed to create session for user with ID %d: %v", user.id, err)
	} else {
		http.SetCookie(w, cookieWithSession(session))
	}

	// Redirect to user profile.
	http.Redirect(w, r, fmt.Sprintf("/users/%d", user.id), http.StatusSeeOther)
	return nil
}

func signUpHandler(w http.ResponseWriter, r *http.Request) error {
	data := SiteData{Title: "Sign Up", FormError: make(map[string]string)}

	if r.Method == http.MethodGet {
		// Redirect to user profile if already signed in.
		if user, ok := userFromContext(r.Context()); ok {
			http.Redirect(w, r, fmt.Sprintf("/users/%d", user.id), http.StatusSeeOther)
			return nil
		}
		// Serve sign-up page.
		return serveTemplate(w, signUpTmpl, data)
	}

	// Validate email, firstname, surname, and password.
	if r.FormValue("email") == "" {
		data.FormError["email"] = "Require email."
	} else if _, err := mail.ParseAddress(r.FormValue("email")); err != nil {
		data.FormError["email"] = "Invalid email."
	} else if i := slices.IndexFunc(users, func(u User) bool { return u.email == r.FormValue("email") }); i != -1 {
		data.FormError["email"] = "Email already taken."
	}
	if r.FormValue("firstname") == "" {
		data.FormError["firstname"] = "Require firstname."
	} else if !regexp.MustCompile(`^( *[a-zA-Z] *){2,32}$`).MatchString(r.FormValue("firstname")) {
		data.FormError["firstname"] = "Invalid firstname."
	}
	if r.FormValue("surname") == "" {
		data.FormError["surname"] = "Require surname."
	} else if !regexp.MustCompile(`^( *[a-zA-Z] *){2,32}$`).MatchString(r.FormValue("surname")) {
		data.FormError["surname"] = "Invalid surname."
	}
	if r.FormValue("password") == "" {
		data.FormError["password"] = "Require password."
	} else if len(r.FormValue("password")) < 8 || len(r.FormValue("password")) > 32 {
		data.FormError["password"] = "Invalid password."
	} else if r.FormValue("password-confirm") == "" {
		data.FormError["password-confirm"] = "Please confirm password."
	} else if r.FormValue("password-confirm") != r.FormValue("password") {
		data.FormError["password-confirm"] = "Password does not match."
	}

	// Serve form error(s).
	if len(data.FormError) > 0 {
		return serveTemplate(w, signUpTmpl, data)
	}

	// Create user.
	user := User{
		id:        users[len(users)-1].id + 1,
		email:     r.FormValue("email"),
		firstname: r.FormValue("firstname"),
		surname:   r.FormValue("surname"),
		password:  r.FormValue("password"),
	}
	users = append(users, user)

	// Set session cookie.
	if session, err := newSession(user.id); err != nil {
		return fmt.Errorf("failed to create session for user with ID %d: %v", user.id, err)
	} else {
		http.SetCookie(w, cookieWithSession(session))
	}

	// Redirect to user profile.
	http.Redirect(w, r, fmt.Sprintf("/users/%d", user.id), http.StatusSeeOther)
	return nil
}

func signOutHandler(w http.ResponseWriter, r *http.Request) error {
	cookie, err := r.Cookie("session")
	if err != nil && !errors.Is(err, http.ErrNoCookie) {
		return err
	}

	// Invalidate session cookie by removing the session from our cache.
	delete(sessions, cookie.Value)

	http.Redirect(w, r, "/users/sign-in", http.StatusSeeOther)
	return nil
}

func makeHandler(fn func(http.ResponseWriter, *http.Request) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Log request.
		log.Printf(`Request: "%s %s"`, r.Method, r.URL)

		// Authenticate user.
		if u := userFromCookie(r); !u.isAnonymous() {
			r = r.WithContext(contextWithUser(r.Context(), u))
		}

		// Handle request, and on failure, log error and serve a simple error page.
		if err := fn(w, r); err != nil {
			siteErr := parseSiteError(err)

			// Log system error.
			if err := errors.Unwrap(siteErr); siteErr.code == http.StatusInternalServerError && err != nil {
				log.Printf("Failed to handle request: %v\n", err)
			}

			// Write error status code and text.
			w.WriteHeader(siteErr.code)
			if _, err := fmt.Fprintln(w, http.StatusText(siteErr.code)); err != nil {
				log.Printf("Failed to write error status text: %v\n", err)
			}
		}
	}
}

// serveTemplate guarantees that we only write when template has been executed successfully, this helps with preventing partial and superfluous writes.
func serveTemplate(w io.Writer, tmpl *template.Template, data any) error {
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return fmt.Errorf("serveTemplate: failed to execute template: %v", err)
	}
	if _, err := buf.WriteTo(w); err != nil {
		return fmt.Errorf("serveTemplate: failed to write template: %v", err)
	}
	return nil
}

func cookieWithSession(s Session) *http.Cookie {
	return &http.Cookie{
		Name:     "session",
		Value:    s.id,
		Path:     "/",
		Domain:   "127.0.0.1",
		MaxAge:   60,   // 60 seconds
		Secure:   true, // HTTPS or localhost
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	}
}

func userFromCookie(r *http.Request) User {
	// Extract session cookie from request.
	cookie, err := r.Cookie("session")
	if err != nil {
		return User{}
	}

	// Verify and retrieve session information.
	session, ok := sessions[cookie.Value]
	if !ok {
		return User{}
	}

	// Find user associated with session.
	i := slices.IndexFunc(users, func(u User) bool { return u.id == session.userID })
	if i == -1 {
		return User{}
	}

	// Return authenticated user.
	return users[i]
}
