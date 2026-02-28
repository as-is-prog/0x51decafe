import { io } from "socket.io-client";
import { socketUrl } from "./api";

export const socket = io(socketUrl, {
  autoConnect: false,
  transports: ["websocket"],
  withCredentials: true,
});

// PTY Event types
export const PtyEvents = {
  // Client -> Server
  PTY_START: "pty:start",
  PTY_INPUT: "pty:input",
  PTY_RESIZE: "pty:resize",
  PTY_STOP: "pty:stop",
  PTY_SAVE_PROMPT: "pty:savePrompt",
  // Server -> Client
  PTY_OUTPUT: "pty:output",
  PTY_EXIT: "pty:exit",
  PTY_READY: "pty:ready",
} as const;
