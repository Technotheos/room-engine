import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { useWebSocket } from './hooks/useWebSocket';
import { MessageSquare, ArrowLeft, Send, Users, ShieldCheck } from 'lucide-react';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');

  // Room & Chat states
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');

  // Check localStorage on initial load
  useEffect(() => {
    const savedToken = localStorage.getItem('jwt_token');
    const savedUser = localStorage.getItem('username');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUsername(savedUser);
    }
  }, []);

  const { messages, sendMessage } = useWebSocket(selectedRoom, username!);

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('username');
    setToken(null);
    setUsername(null);
    setSelectedRoom(null);
  };

  // 1. If not authenticated, show Login or Signup
  if (!token || !username) {
    if (authView === 'signup') {
      return (
        <Signup
          onSignupSuccess={() => setAuthView('login')}
          onSwitchToLogin={() => setAuthView('login')}
        />
      );
    }
    return (
      <Login
        onLoginSuccess={(newToken, newUser) => {
          setToken(newToken);
          setUsername(newUser);
        }}
        onSwitchToSignup={() => setAuthView('signup')}
      />
    );
  }

  // 2. If authenticated but no room selected, show the Workspace Menu
  if (!selectedRoom) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Learn Block Rooms</h1>
              <p className="text-sm text-slate-400 mt-1">Logged in as: <span className="text-blue-400 font-medium">{username}</span></p>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>

          <div className="space-y-3">
            {[
              { id: 'nasdaq-scalping', title: 'Nasdaq 1-Min Scalping Room', desc: 'Order flow dynamics, 3 to 8-minute scalp setups, and delta tracking.' },
              { id: 'wasm-exploit', title: 'WebAssembly & Memory Exploitation', desc: 'Low-level sandboxing, JS engine heap smearing, and zero-day analysis.' },
              { id: 'sys-go', title: 'Go Distributed Architecture', desc: 'Goroutines, thread-safe room broadcast packets, and WebSocket lifecycle.' },
            ].map((room) => (
              <div
                key={room.id}
                onClick={() => setSelectedRoom(room.id)}
                className="p-4 bg-slate-950/50 hover:bg-slate-950 border border-slate-800/80 hover:border-blue-600/50 rounded-2xl cursor-pointer transition-all group"
              >
                <h3 className="text-blue-400 font-semibold group-hover:text-blue-300 transition-colors">{room.title}</h3>
                <p className="text-xs text-slate-400 mt-1">{room.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 3. Active Room Chat View
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <button
            onClick={() => setSelectedRoom(null)}
            className="flex items-center gap-2 text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <span className="font-semibold text-slate-200">Room: {selectedRoom}</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 py-4 pr-2">
          {messages.map((msg, index) => (
            <div key={index} className="p-3 bg-slate-950/60 border border-slate-800/60 rounded-xl">
              <span className="text-xs font-semibold text-blue-400">{msg.sender}</span>
              <p className="text-sm text-slate-200 mt-0.5">{msg.content}</p>
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!inputMessage.trim()) return;
            sendMessage(inputMessage);
            setInputMessage('');
          }}
          className="flex gap-2 pt-4 border-t border-slate-800"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-600"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl transition-colors flex items-center justify-center"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}