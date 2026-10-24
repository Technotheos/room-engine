import { useState, useEffect, useRef } from 'react';

export default function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [roomId, setRoomId] = useState('nasdaq-scalps');
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  // 1. Handle Login to get JWT
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const res = await fetch('http://localhost:8080/api/login', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
      alert('Logged in successfully!');
    } else {
      alert('Login failed');
    }
  };

  // 2. Connect to WebSocket once token is present
  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(`ws://localhost:8080/ws?token=${token}&room_id=${roomId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      setMessages((prev) => [...prev, msg]);
    };

    return () => {
      ws.close();
    };
  }, [token, roomId]);

  // 3. Send Message
  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload = { action: 'chat', content: input };
      wsRef.current.send(JSON.stringify(payload));
      
      // Append our own message locally since the server skips echoing back to sender
      setMessages((prev) => [...prev, { sender: username, content: input }]);
      setInput('');
    }
  };

  if (!token) {
    return (
      <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
        <h2>Learn Block - Login</h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', width: '300px', gap: '10px' }}>
          <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit">Login & Connect</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h2>Room: {roomId} (Logged in as: {username})</h2>
      <div style={{ border: '1px solid #ccc', height: '300px', overflowY: 'scroll', padding: '10px', marginBottom: '10px' }}>
        {messages.map((m, i) => (
          <div key={i}>
            <strong>{m.sender}: </strong> {m.content}
          </div>
        ))}
      </div>
      <form onSubmit={sendMessage} style={{ display: 'flex', gap: '10px' }}>
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message..." style={{ flex: 1 }} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}