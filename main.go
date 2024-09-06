package main

import (
	"log"
	"net/http"
)

func main() {
	mux := http.NewServeMux()
	registerSite(mux)
	if err := http.ListenAndServe(":8080", mux); err != nil {
		log.Fatal(err)
	}
}
