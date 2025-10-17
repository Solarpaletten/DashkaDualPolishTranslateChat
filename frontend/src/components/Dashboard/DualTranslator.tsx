import React, { useEffect, useRef, useState } from 'react';
import { useTranslator } from '../../hooks/useTranslator';
import RoomJoin from './RoomJoin';

const DualTranslator: React.FC = () => {
  const {
    originalText,
    translatedText,
    isRecording,
    status,
    toggleRecording,
    connectionStatus,
    recognitionLang,
    setRecognitionLang,
    websocketRef,
    setOriginalText,
    performTranslation
  } = useTranslator();

  const dialects = ['pl-PL', 'ru-RU'];
  const dialectNames = {
    'pl-PL': '🇵🇱 Polski',
    'ru-RU': '🇷🇺 Rosyjski'
  };

  const [dialect, setDialect] = useState(recognitionLang);
  const [dialectIndex, setDialectIndex] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [showRoomJoin, setShowRoomJoin] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [username, setUsername] = useState('');
  const [isWakingUp, setIsWakingUp] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{
    speaker: string;
    lang: string;
    text: string;
    translation: string;
    timestamp: string;
  }>>([]);

  const leftPanelRef = useRef<HTMLTextAreaElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  const handleJoinRoom = (code: string, name: string) => {
    setRoomCode(code);
    setUsername(name);

    if (websocketRef?.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({
        type: 'join_room',
        room: code,
        username: name
      }));
      setIsConnected(true);
    }
  };

  const switchDialect = () => {
    const nextIndex = (dialectIndex + 1) % dialects.length;
    setDialectIndex(nextIndex);
    const newDialect = dialects[nextIndex];
    setDialect(newDialect);
    setRecognitionLang(newDialect);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(`${label} skopiowano`);
    } catch {
      alert('Błąd');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' && !isRecording) {
        e.preventDefault();
        const nextIndex = (dialectIndex + 1) % dialects.length;
        setDialectIndex(nextIndex);
        const newDialect = dialects[nextIndex];
        setDialect(newDialect);
        setRecognitionLang(newDialect);
      } else if (e.code === 'Space') {
        e.preventDefault();
        toggleRecording();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialectIndex, isRecording]);

  useEffect(() => {
    if (translatedText && translatedText !== 'Tłumaczenie pojawi się tutaj...' && originalText) {
      const newEntry = {
        speaker: username || (dialect.startsWith('ru') ? 'RU' : 'PL'),
        lang: dialect,
        text: originalText,
        translation: translatedText,
        timestamp: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
      };
      setConversationHistory(prev => {
        if (prev.length > 0 && prev[prev.length - 1].text === originalText) return prev;
        return [...prev, newEntry];
      });
    }
  }, [translatedText]);

  useEffect(() => setDialect(recognitionLang), [recognitionLang]);
  useEffect(() => {
    if (leftPanelRef.current) leftPanelRef.current.scrollTop = leftPanelRef.current.scrollHeight;
  }, [originalText]);
  useEffect(() => {
    if (rightPanelRef.current) rightPanelRef.current.scrollTop = rightPanelRef.current.scrollHeight;
  }, [translatedText]);

  const pasteToOriginal = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setOriginalText(text);
      performTranslation(text);
    } catch {
      alert('Błąd wklejania');
    }
  };

  const wakeUpAPI = async () => {
    setIsWakingUp(true);
    setStatus('⏰ Budzę backend...');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/health`);

      if (response.ok) {
        setStatus('✅ Backend obudzony!');
        if (websocketRef?.current) {
          websocketRef.current.close();
        }
      } else {
        setStatus('❌ Backend nie odpowiada');
      }
    } catch (error) {
      setStatus('❌ Błąd połączenia');
    } finally {
      setIsWakingUp(false);
    }
  };

  return (
    <>
      {!isConnected && showRoomJoin && (
        <RoomJoin 
          onJoin={handleJoinRoom} 
          onClose={() => setShowRoomJoin(false)} 
        />
      )}
      <div className="w-full h-screen flex flex-col bg-gradient-to-br from-purple-600 via-blue-600 to-teal-600">
        <header className="flex justify-between items-center p-6 flex-wrap gap-3">
          <h1 className="text-white text-3xl font-bold">🎤 Dual Translator</h1>
          <div className="flex items-center gap-3">
            {/* Wskaźniki stanu API */}
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
              <span className="text-white text-sm font-medium">API</span>
              <div
                className={`w-3 h-3 rounded-full ${connectionStatus.ai ? 'bg-green-400' : 'bg-red-400'}`}
                title={connectionStatus.ai ? 'Backend dostępny' : 'Backend niedostępny'}
              />
              <div
                className={`w-3 h-3 rounded-full ${connectionStatus.ws ? 'bg-green-400' : 'bg-red-400'}`}
                title={connectionStatus.ws ? 'WebSocket połączony' : 'WebSocket rozłączony'}
              />
            </div>

            {/* Przycisk budzenia */}
            {!connectionStatus.ai && (
              <button
                onClick={wakeUpAPI}
                disabled={isWakingUp}
                className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-300 rounded text-white text-xs font-semibold transition-all"
                title="Obudź backend na Render"
              >
                {isWakingUp ? '⏳' : '⏰ Obudź'}
              </button>
            )}

            {/* Przycisk dołączenia do pokoju - tylko gdy backend gotowy */}
            {connectionStatus.ai && connectionStatus.ws && !isConnected && (
              <button
                onClick={() => setShowRoomJoin(true)}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-white text-sm font-semibold transition-all"
                title="Utwórz lub dołącz do pokoju"
              >
                🚪 Dołącz do pokoju
              </button>
            )}

            {/* Przycisk Start/Stop */}
            <button
              onClick={toggleRecording}
              className={`px-8 py-4 rounded-xl font-semibold text-white text-lg shadow-lg transition-all ${isRecording ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-green-600 hover:bg-green-700'
                }`}
            >
              {isRecording ? '⏹️ Zatrzymaj' : '▶️ Start'}
            </button>
          </div>
          {/* Wybór języka */}
          <button
            onClick={switchDialect}
            className="px-4 py-2 bg-white/20 text-white rounded-lg font-semibold hover:bg-white/30"
          >
            {dialectNames[dialect as keyof typeof dialectNames]}
          </button>
        </header>

        {/* Pasek statusu */}
        <div className="px-6 pb-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 text-center text-white">
            <span>{status}</span>
            <span className="ml-3 text-sm opacity-70">
              {isConnected ? `Pokój: ${roomCode} | ${username}` : '(Enter = język | Spacja = nagrywanie)'}
            </span>
          </div>
        </div>

        <main className="flex-1 flex gap-4 px-6 pb-6">
          {/* Lewy panel - Oryginał */}
          <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-2xl p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white text-xl font-semibold">🗣️ Oryginał</h2>
              <div className="flex gap-2">
                <button
                  onClick={pasteToOriginal}
                  className="px-3 py-1 bg-blue-500 hover:bg-blue-600 rounded-lg text-white text-sm"
                >
                  📋 Wklej
                </button>
                <button
                  onClick={() => copyToClipboard(originalText, 'Oryginał')}
                  className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm"
                >
                  📋 Kopiuj
                </button>
              </div>
            </div>
            <textarea
              ref={leftPanelRef}
              value={originalText}
              onChange={(e) => setOriginalText(e.target.value)}
              onKeyDown={(e) => {
                if (e.ctrlKey && e.key === 'v') {
                  e.preventDefault();
                  pasteToOriginal();
                }
                if (e.ctrlKey && e.key === 'Enter') {
                  e.preventDefault();
                  performTranslation(originalText);
                }
              }}
              placeholder="Zacznij mówić lub wklej tekst..."
              className="flex-1 bg-white/5 rounded-xl p-4 text-white text-lg leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>

          {/* Prawy panel - Tłumaczenie */}
          <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-2xl p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white text-xl font-semibold">🌐 Tłumaczenie</h2>
              <button
                onClick={() => copyToClipboard(translatedText, 'Tłumaczenie')}
                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm"
              >
                📋 Kopiuj
              </button>
            </div>
            <div ref={rightPanelRef} className="flex-1 bg-white/5 rounded-xl p-4 overflow-y-auto">
              <p className="text-white text-lg leading-relaxed whitespace-pre-wrap">
                {translatedText || 'Tłumaczenie pojawi się tutaj...'}
              </p>
            </div>
          </div>
        </main>

        {/* Stopka - Historia rozmowy */}
        <footer className="bg-white/10 backdrop-blur-sm p-6 text-white">
          <h3 className="font-semibold mb-3 text-lg">🕐 Historia rozmowy</h3>
          <div className="max-h-48 overflow-y-auto space-y-3 pr-2">
            {conversationHistory.length === 0 ? (
              <p className="text-white/50 text-center py-4">Historia jest pusta</p>
            ) : (
              conversationHistory.map((msg, index) => (
                <div key={index} className="bg-white/10 rounded-lg p-3 border-l-4 border-white/30">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold">{msg.speaker}</span>
                    <span className="text-sm opacity-70">{msg.timestamp}</span>
                  </div>
                  <div className="text-base">
                    <p className="mb-1">{msg.text}</p>
                    <p className="text-white/80 italic">→ {msg.translation}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </footer>
      </div>
    </>
  );
};

export default DualTranslator;