"use client";
import { useState, useRef, useEffect } from "react";
import { useSocket } from "../../context/SocketProvider";
import classes from "../page.module.css";

export default function Page() {
  const { sendMessage, messages } = useSocket();
  const [username, setUsername] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const saved = localStorage.getItem("chat-username");
    if (saved) setUsername(saved);
  }, []);

  const handleJoin = () => {
    const trimmed = nameInput.trim();
    if (trimmed) {
      setUsername(trimmed);
      localStorage.setItem("chat-username", trimmed);
    }
  };

  const handleSend = () => {
    if (!message.trim() || !username) return;
    sendMessage(message, username);
    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleJoin();
    }
  };

  if (!username) {
    return (
      <div className={classes["join-container"]}>
        <div className={classes["join-card"]}>
          <div className={classes["join-icon"]}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h1 className={classes["join-title"]}>Welcome to Chat</h1>
          <p className={classes["join-subtitle"]}>
            Enter your name to start chatting
          </p>
          <div className={classes["join-form"]}>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={handleNameKeyDown}
              placeholder="Your name..."
              className={classes["join-input"]}
              autoFocus
              maxLength={20}
            />
            <button
              onClick={handleJoin}
              className={classes["join-button"]}
              disabled={!nameInput.trim()}
            >
              Join Chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getInitials = (name: string) => name.slice(0, 2).toUpperCase();
  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={classes["chat-container"]}>
      <header className={classes["chat-header"]}>
        <div className={classes["header-left"]}>
          <div className={classes["header-dot"]} />
          <h1 className={classes["header-title"]}>Scalable Chat</h1>
        </div>
        <div className={classes["header-user"]}>
          <div className={classes["user-avatar"]}>{getInitials(username)}</div>
          <span className={classes["user-name"]}>{username}</span>
        </div>
      </header>

      <div className={classes["messages-area"]}>
        {messages.map((msg) => {
          const isOwn = msg.sender === username;
          return (
            <div
              key={msg.id}
              className={`${classes["message-row"]} ${isOwn ? classes["message-own"] : ""}`}
            >
              {!isOwn && (
                <div className={classes["msg-avatar"]}>
                  {getInitials(msg.sender)}
                </div>
              )}
              <div className={classes["message-bubble"]}>
                {!isOwn && (
                  <span className={classes["msg-sender"]}>{msg.sender}</span>
                )}
                <span className={classes["msg-text"]}>{msg.text}</span>
                <span className={classes["msg-time"]}>
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className={classes["input-area"]}>
        <div className={classes["input-wrapper"]}>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className={classes["chat-input"]}
            autoFocus
          />
          <button
            onClick={handleSend}
            className={classes["send-button"]}
            disabled={!message.trim()}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
