import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import Home from './pages/Home';
import RoomView from './roomView'; // Since roomView.tsx is directly inside src/
import { useWebSocket } from './hooks/useWebSocket';
import { ArrowLeft, Send } from 'lucide-react';

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

  const { messages, sendMessage } = useWebSocket(selectedRoom!);

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

  // 2. If authenticated but no room selected, show your new Home Dashboard
  if (!selectedRoom) {
    return (
      <Home 
        username={username}
        onSelectRoom={(roomId) => setSelectedRoom(roomId)}
        onLogout={handleLogout}
      />
    );
  }

  // 3. Active Room Chat View (using your roomView or embedded layout)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <button
            onClick={() => setSelectedRoom(null)}
            className="flex items-center gap-2 text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl transition-colors"
          >
            <ArrowLeft size={16} /> Back to Dashboard
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