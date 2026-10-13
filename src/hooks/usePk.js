import { useEffect, useRef, useState } from "react";

const SEAT_KEY = "nba-pk-seat";
const NAME_KEY = "nba-pk-name";

function readSeat() {
  try {
    const seat = JSON.parse(sessionStorage.getItem(SEAT_KEY) || "null");
    if (!seat?.code || !seat?.playerId || !seat?.token) return null;
    return seat;
  } catch {
    return null;
  }
}

function writeSeat(seat) {
  try {
    sessionStorage.setItem(SEAT_KEY, JSON.stringify(seat));
  } catch {
    // A private browser can still play the current match.
  }
}

function clearSeat() {
  try {
    sessionStorage.removeItem(SEAT_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function hasPkSeat() {
  return Boolean(readSeat());
}

export function savedPkName() {
  try {
    return sessionStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}

function rememberName(name) {
  try {
    sessionStorage.setItem(NAME_KEY, name);
  } catch {
    // Ignore storage failures.
  }
}

function socketUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/pk`;
}

export function usePk() {
  const [view, setView] = useState(null);
  const [link, setLink] = useState("offline");
  const [error, setError] = useState("");
  const [rejectedRound, setRejectedRound] = useState(null);
  const socketRef = useRef(null);
  const seatRef = useRef(readSeat());
  const stopRef = useRef(false);
  const retriesRef = useRef(0);
  const reconnectRef = useRef(0);

  function send(message) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }

  function open(onOpen) {
    const previous = socketRef.current;
    if (previous) {
      previous.onclose = null;
      previous.close();
    }
    const socket = new WebSocket(socketUrl());
    socketRef.current = socket;
    setLink((current) => (current === "live" ? "reconnecting" : "connecting"));
    socket.onopen = () => {
      if (socketRef.current !== socket) return;
      retriesRef.current = 0;
      setLink("live");
      onOpen(socket);
    };
    socket.onmessage = (event) => {
      if (socketRef.current !== socket) return;
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message?.type === "state") {
        setError("");
        setView(message);
        if (message.code && message.you && message.token) {
          const seat = { code: message.code, playerId: message.you, token: message.token };
          seatRef.current = seat;
          writeSeat(seat);
        }
        return;
      }
      if (message?.type === "error") {
        setError(message.message || "Something went wrong");
        if (message.message === "Room not found") {
          seatRef.current = null;
          clearSeat();
          stopRef.current = true;
          setView(null);
        }
        return;
      }
      if (message?.type === "answer-rejected") {
        setRejectedRound(message.roundId || null);
      }
    };
    socket.onclose = () => {
      if (socketRef.current !== socket) return;
      socketRef.current = null;
      if (stopRef.current || !seatRef.current) {
        setLink("offline");
        return;
      }
      setLink("reconnecting");
      const delay = Math.min(4000, 300 * (2 ** retriesRef.current));
      retriesRef.current += 1;
      window.clearTimeout(reconnectRef.current);
      reconnectRef.current = window.setTimeout(() => {
        if (stopRef.current || !seatRef.current) return;
        const seat = seatRef.current;
        open((next) => {
          next.send(JSON.stringify({
            type: "resume",
            code: seat.code,
            playerId: seat.playerId,
            token: seat.token,
          }));
        });
      }, delay);
    };
  }

  useEffect(() => {
    const seat = readSeat();
    if (!seat) return undefined;
    seatRef.current = seat;
    stopRef.current = false;
    open((socket) => {
      socket.send(JSON.stringify({
        type: "resume",
        code: seat.code,
        playerId: seat.playerId,
        token: seat.token,
      }));
    });
    return () => {
      stopRef.current = true;
      window.clearTimeout(reconnectRef.current);
      const socket = socketRef.current;
      socketRef.current = null;
      if (!socket) return;
      socket.onclose = null;
      socket.close();
    };
  }, []);

  return {
    view,
    link,
    error,
    rejectedRound,
    create(name, mode) {
      const clean = String(name || "").trim().slice(0, 16);
      rememberName(clean);
      const existing = socketRef.current;
      if (existing && existing.readyState === WebSocket.OPEN) {
        existing.send(JSON.stringify({ type: "leave" }));
      }
      stopRef.current = false;
      seatRef.current = null;
      clearSeat();
      setError("");
      open((socket) => {
        socket.send(JSON.stringify({ type: "create", name: clean, mode }));
      });
    },
    join(name, code) {
      const clean = String(name || "").trim().slice(0, 16);
      rememberName(clean);
      const existing = socketRef.current;
      if (existing && existing.readyState === WebSocket.OPEN) {
        existing.send(JSON.stringify({ type: "leave" }));
      }
      stopRef.current = false;
      seatRef.current = null;
      clearSeat();
      setError("");
      open((socket) => {
        socket.send(JSON.stringify({ type: "join", name: clean, code }));
      });
    },
    setMode(mode) {
      send({ type: "mode", mode });
    },
    setReady(ready) {
      send({ type: "ready", ready });
    },
    answer(roundId, value) {
      setRejectedRound(null);
      send({ type: "answer", roundId, value });
    },
    rematch(rematch) {
      send({ type: "rematch", rematch });
    },
    leave() {
      stopRef.current = true;
      window.clearTimeout(reconnectRef.current);
      seatRef.current = null;
      clearSeat();
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "leave" }));
      }
      socketRef.current = null;
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      setView(null);
      setLink("offline");
      setError("");
    },
  };
}
