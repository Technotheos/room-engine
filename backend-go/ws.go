package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Message struct {
	RoomID  string `json:"room_id"`
	Sender  string `json:"sender"`
	Action  string `json:"action"`
	Content string `json:"content"`
}

type Client struct {
	conn *websocket.Conn
	room *Room
	send chan []byte
}

type BroadcastPacket struct {
	Sender *Client
	Data   []byte
}

type Room struct {
	ID         string
	clients    map[*Client]bool
	broadcast  chan BroadcastPacket
	register   chan *Client
	unregister chan *Client
	mu         sync.Mutex
}

func NewRoom(id string) *Room {
	return &Room{
		ID:         id,
		clients:    make(map[*Client]bool),
		broadcast:  make(chan BroadcastPacket),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (r *Room) Run() {
	for {
		select {
		case client := <-r.register:
			r.mu.Lock()
			r.clients[client] = true
			r.mu.Unlock()
			log.Printf("[+] Client joined Room [%s]. Active clients: %d", r.ID, len(r.clients))

		case client := <-r.unregister:
			r.mu.Lock()
			if _, ok := r.clients[client]; ok {
				delete(r.clients, client)
				close(client.send)
				client.conn.Close()
				log.Printf("[-] Client left Room [%s]. Active clients remaining: %d", r.ID, len(r.clients))
			}
			r.mu.Unlock()

		case packet := <-r.broadcast:
			r.mu.Lock()
			for client := range r.clients {
				if client == packet.Sender {
					continue
				}

				select {
				case client.send <- packet.Data:
				default:
					close(client.send)
					delete(r.clients, client)
					client.conn.Close()
				}
			}
			r.mu.Unlock()
		}
	}
}

type Manager struct {
	rooms map[string]*Room
	mu    sync.Mutex
}

func NewManager() *Manager {
	return &Manager{
		rooms: make(map[string]*Room),
	}
}

func (m *Manager) GetOrCreateRoom(roomID string) *Room {
	m.mu.Lock()
	defer m.mu.Unlock()

	room, exists := m.rooms[roomID]
	if !exists {
		room = NewRoom(roomID)
		m.rooms[roomID] = room
		go room.Run()
		log.Printf("🚀 [NEW ROOM SPAWNED]: %s", roomID)
	}
	return room
}

func (m *Manager) HandleWS(w http.ResponseWriter, r *http.Request) {
	tokenStr := r.URL.Query().Get("token")
	roomID := r.URL.Query().Get("room_id")

	if roomID == "" {
		roomID = "general"
	}

	claims, err := ValidateJWT(tokenStr)
	if err != nil {
		http.Error(w, "Unauthorized: Invalid or missing token", http.StatusUnauthorized)
		return
	}
	sender := claims.Username

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Upgrade error: %v", err)
		return
	}

	room := m.GetOrCreateRoom(roomID)

	client := &Client{
		conn: conn,
		room: room,
		send: make(chan []byte, 256),
	}

	room.register <- client

	go func() {
		defer func() {
			room.unregister <- client
		}()

		for {
			_, rawBytes, err := conn.ReadMessage()
			if err != nil {
				break
			}

			var msg Message
			if err := json.Unmarshal(rawBytes, &msg); err != nil {
				continue
			}

			msg.RoomID = room.ID
			msg.Sender = sender

			outbound, err := json.Marshal(msg)
			if err != nil {
				continue
			}

			room.broadcast <- BroadcastPacket{
				Sender: client,
				Data:   outbound,
			}
		}
	}()

	go func() {
		defer client.conn.Close()
		for message := range client.send {
			err := client.conn.WriteMessage(websocket.TextMessage, message)
			if err != nil {
				break
			}
		}
	}()
}