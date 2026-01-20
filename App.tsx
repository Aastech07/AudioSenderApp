import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, AppState } from "react-native";
import io from "socket.io-client";
import {
  RTCPeerConnection,
  mediaDevices,
  MediaStream
} from "react-native-webrtc";

export default function App() {
  const [status, setStatus] = useState("Disconnected");
  const [micOn, setMicOn] = useState(false);

  const socketRef = useRef<any>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    connect();

    const sub = AppState.addEventListener("change", state => {
      if (state !== "active") stopMic();
    });

    return () => {
      sub.remove();
      cleanup();
    };
  }, []);

  const connect = async () => {
    setStatus("Connecting");

    socketRef.current = io("https://recorderbackend.onrender.com", {
      transports: ["websocket"],
    });

    pcRef.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    socketRef.current.on("connect", () => {
      setStatus("Connected");
    });

    socketRef.current.on("audio-toggle", enabled => {
      enabled ? startMic() : stopMic();
    });

    socketRef.current.on("answer", async answer => {
      await pcRef.current?.setRemoteDescription(answer);
      setStatus("Streaming");
    });

    socketRef.current.on("ice-candidate", candidate => {
      pcRef.current?.addIceCandidate(candidate);
    });
  };

  const startMic = async () => {
    setMicOn(true);

    if (!streamRef.current) {
      const stream = await mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      stream.getTracks().forEach(track =>
        pcRef.current?.addTrack(track, stream)
      );

      pcRef.current!.onicecandidate = e => {
        e.candidate &&
          socketRef.current.emit("ice-candidate", e.candidate);
      };

      const offer = await pcRef.current!.createOffer();
      await pcRef.current!.setLocalDescription(offer);
      socketRef.current.emit("offer", offer);
    }

    streamRef.current.getAudioTracks().forEach(t => (t.enabled = true));
    setStatus("Streaming");
  };

  const stopMic = () => {
    setMicOn(false);
    streamRef.current?.getAudioTracks().forEach(t => (t.enabled = false));
    setStatus("Muted");
  };

  const cleanup = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    socketRef.current?.disconnect();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Live Audio Stream</Text>
      <Text style={styles.status}>{status}</Text>
      <Text style={styles.mic}>{micOn ? "🎤 MIC ON" : "🔇 MIC OFF"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    color: "#fff",
    fontSize: 26,
    marginBottom: 20
  },
  status: {
    color: "#38bdf8",
    fontSize: 16
  },
  mic: {
    marginTop: 10,
    color: "#fff",
    fontSize: 18
  }
});
