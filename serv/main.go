package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1048576,
	WriteBufferSize: 1048576,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

var gameOffers = make(map[string]GameOffer)
var offerers = make(map[*websocket.Conn]string)

type GameOffer struct {
	conn *websocket.Conn
	data map[string]any
}

type Message struct {
	sender  *websocket.Conn
	content []byte
}

var ids = make(map[*websocket.Conn]int)
var usedIDs = make(map[int]struct{})

// var conns = make(map[int]*websocket.Conn)
type Game struct {
	conn       *websocket.Conn
	connID     int
	unsentMsgs []string
}

var games = make(map[int]*Game)

// var register = make(chan *websocket.Conn)
var unregister = make(chan *websocket.Conn)
var broadcast = make(chan Message)

const codeActivated = "A"
const codeQuit = "Q"
const codeEndedTurn = "E"
const codeHammered = "H"
const codePlayedCard = "P"
const codeCreateGame = "C"
const codeJoinGame = "J"
const codeResign = "R"
const codeGameOver = "O"
const codeRejoinGame = "B"
const codeDeleteOffer = "D"
const codeListGames = "L"

func handleConnections(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Printf("Error upgrading connection: %v\n", err)
		return
	}
	defer ws.Close()

	// register <- ws
	defer func() {
		unregister <- ws
	}()

	for {
		_, message, err := ws.ReadMessage()
		if err != nil {
			fmt.Printf("Error reading message: %v\n", err)
			break
		}
		broadcast <- Message{sender: ws, content: message}
	}
}

var nextID int = 0
var nextGame int = 0

func writeMessage(client *websocket.Conn, data []byte) bool {
	fmt.Printf(">%s\n", string(data))
	err := client.WriteMessage(websocket.TextMessage, data)
	if err != nil {
		fmt.Printf("Error writing message: %v\n", err)
		client.Close()
		delete(ids, client)
		return false
	}
	return true
}

func handleMessages() {
	for {
		select {
		// case _ = <-register:
		// 	fmt.Printf("oh nao\n")
		case client := <-unregister:
			if id, exists := ids[client]; exists {
				delete(ids, client)
				delete(usedIDs, id)
				if name, exists := offerers[client]; exists {
					delete(gameOffers, name)
					delete(offerers, client)
				}

				game, exists := games[id]
				if exists {
					if game.conn == nil {
						delete(games, id)
						delete(games, game.connID)
					} else {
						writeMessage(game.conn, []byte(codeQuit))
						games[game.connID].conn = nil
					}
				}
			}
		case message := <-broadcast:
			if myID, exists := ids[message.sender]; !exists {
				id, err := strconv.Atoi(string(message.content))
				if err != nil {
					writeMessage(message.sender, []byte(fmt.Sprint(-1)))
				} else {
					if id == -1 {
						id = nextID
						nextID++
					}
					for {
						if _, exists := usedIDs[id]; !exists {
							break
						}
						id = nextID
						nextID++
					}
					writeMessage(message.sender, []byte(fmt.Sprint(id)))

					ids[message.sender] = id
					usedIDs[id] = struct{}{}
					if game, exists := games[id]; exists {
						writeMessage(game.conn, []byte(codeJoinGame))
					}
				}
			} else {
				switch string(message.content[0]) {
				case codeCreateGame:
					var j struct {
						Name string
						Data map[string]any
					}
					json.Unmarshal(message.content[1:], &j)
					if j.Name == "" {
						j.Name = fmt.Sprintf("game%d", nextGame)
						nextGame++
					}
					_, exists := gameOffers[j.Name]
					if !exists {
						if name, exists := offerers[message.sender]; exists {
							delete(gameOffers, name)
						}
						gameOffers[j.Name] = GameOffer{
							conn: message.sender,
							data: j.Data,
						}
						offerers[message.sender] = j.Name
						writeMessage(message.sender, []byte("{}"))
					} else {
						writeMessage(message.sender, []byte(`{"error":"Nome já existe!","code":0}`))
					}

				case codeJoinGame:
					var j struct {
						Name string         `json:"name"`
						Data map[string]any `json:"data"`
					}
					json.Unmarshal(message.content[1:], &j)
					gameOffer, exists := gameOffers[j.Name]
					if !exists {
						writeMessage(message.sender, []byte(`{"error":"Jogo foi deletado","code":0}`))
					} else {
						otherID := ids[gameOffer.conn]
						games[myID] = &Game{gameOffer.conn, otherID, []string{}}
						games[otherID] = &Game{message.sender, myID, []string{}}

						// coinflip := rand.Intn(2)
						coinflip := 0
						j.Data["myTurn"] = coinflip
						m1, _ := json.Marshal(j.Data)
						writeMessage(gameOffer.conn, m1)
						gameOffer.data["myTurn"] = 1 - coinflip
						m2, _ := json.Marshal(gameOffer.data)
						writeMessage(message.sender, m2)

						delete(gameOffers, j.Name)
						delete(offerers, gameOffer.conn)
					}

				case codeGameOver:
					if opp, exists := games[myID]; exists {
						delete(games, ids[opp.conn])
					}
					delete(games, myID)

				case codeRejoinGame: // vai acabar
					game, exists := games[myID]
					if !exists {
						writeMessage(message.sender, []byte(`{"error":"Jogo não foi encontrado","code":0}`))
					} else {
						if g2, exists := games[game.connID]; exists {
							g2.conn = message.sender
							writeMessage(message.sender, []byte(`{}`))
							writeMessage(game.conn, []byte(codeRejoinGame))

							for _, msg := range g2.unsentMsgs {
								writeMessage(message.sender, []byte(msg))
							}
							g2.unsentMsgs = []string{}
						} else {
							writeMessage(message.sender, []byte(`{"error":"Jogo foi deletado","code":1}`))
						}
					}

				case codeDeleteOffer:
					if name, exists := offerers[message.sender]; exists {
						delete(gameOffers, name)
						delete(offerers, message.sender)
						writeMessage(message.sender, []byte(`{}`))
					}

				case codeListGames:
					type ListEntry struct {
						Name string         `json:"name"`
						Data map[string]any `json:"data"`
					}
					var gameList []ListEntry
					for k, v := range gameOffers {
						gameList = append(gameList, ListEntry{
							Name: k,
							Data: v.data,
						})
					}
					msg, _ := json.Marshal(gameList)
					writeMessage(message.sender, msg)

				default:
					game, exists := games[myID]
					if exists {
						if game.conn == nil {
							game.unsentMsgs = append(game.unsentMsgs, string(message.content))
						} else {
							writeMessage(game.conn, message.content)
						}
					}
				}
			}
		}
	}
}

func main() {
	// Get the absolute path of the executable file
	exePath, err := os.Executable()
	if err != nil {
		panic(err)
	}

	// Web Socket
	http.HandleFunc("/ws", handleConnections)
	go handleMessages()

	// Get the directory containing the executable file
	dir := filepath.Dir(exePath) + "/../web"

	// Create a file server handler to serve files from the given directory
	fileServer := http.FileServer(http.Dir(dir))

	// Register a handler function to respond to incoming HTTP requests
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Get the requested file path from the URL
		filePath := dir + r.URL.Path

		// Check if the requested file exists
		_, err := os.Stat(filePath)
		if err != nil {
			// If the file doesn't exist, return a 404 Not Found status
			http.Error(w, "File not found", http.StatusNotFound)
			return
		}

		// If the file exists, serve it using the file server handler
		fileServer.ServeHTTP(w, r)
	})

	// Define the port to listen on
	port := ":8080"

	// Start the HTTP server
	fmt.Printf("Server is listening on http://localhost%s\n", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		fmt.Printf("Failed to start server: %s\n", err)
	}
}
