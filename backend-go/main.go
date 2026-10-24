package main

import (
	"log"
	"net/http"
)

func main() {
	manager := NewManager()

	// REST API Authentication Endpoints
	http.HandleFunc("/api/signup", RegisterHandler)
	http.HandleFunc("/api/login", LoginHandler)

	// Secure WebSocket Endpoint
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		manager.HandleWS(w, r)
	})

	log.Println("🚀 Learn Block Backend Engine listening on :8080...")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal(err)
	}
}
