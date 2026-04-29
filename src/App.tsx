/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Target, 
  Play, 
  Layers, 
  FileText, 
  Settings, 
  Wifi, 
  ChevronRight, 
  Plus, 
  Trash2,
  TrendingUp,
  TrendingDown,
  Volume2,
  VolumeX,
  Zap,
  Activity,
  BarChart3,
  Maximize2,
  Download,
  Bell,
  Newspaper,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import confetti from 'canvas-confetti';

interface NewsItem {
  id: string;
  symbol: string;
  title: string;
  source: string;
  time: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  url: string;
}

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Signal {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  price: number;
  tp: number;
  sl: number;
  timestamp: number;
  confidence: number;
  broker: 'JustMarkets' | 'Exness';
  reasoning?: string;
}

interface Trade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  tp: number;
  sl: number;
  pl: number;
  status: 'PROFIT' | 'LOSS';
  duration: string;
  timestamp: number;
  broker: 'JustMarkets' | 'Exness';
}

// --- Components ---

const TradingViewWidget = ({ symbol, theme = 'dark' }: { symbol: string, theme?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (containerRef.current && (window as any).TradingView) {
        new (window as any).TradingView.widget({
          "autosize": true,
          "symbol": symbol.includes(':') ? symbol : `FX_IDC:${symbol}`,
          "interval": "15",
          "timezone": "Etc/UTC",
          "theme": theme,
          "style": "1",
          "locale": "en",
          "toolbar_bg": "#f1f3f6",
          "enable_publishing": false,
          "hide_top_toolbar": false,
          "save_image": false,
          "container_id": containerRef.current.id,
          "backgroundColor": "rgba(0, 0, 0, 0)",
          "gridColor": "rgba(42, 46, 57, 0.06)",
          "studies": [
            "RSI@tv-basicstudies",
            "MASimple@tv-basicstudies"
          ]
        });
      }
    };
    document.head.appendChild(script);
    return () => {
      // Cleanup script if needed, though TradingView usually handles internal state well
      const scripts = document.querySelectorAll('script[src="https://s3.tradingview.com/tv.js"]');
      scripts.forEach(s => s.remove());
    };
  }, [symbol, theme]);

  return (
    <div id={`tv-widget-${symbol.replace(/[^a-zA-Z0-9]/g, '')}`} ref={containerRef} className="w-full h-full" />
  );
};

interface NeonCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  theme?: string;
}

const NeonCard: React.FC<NeonCardProps> = ({ children, className, title, theme = 'amber' }) => {
  const themeColors: Record<string, string> = {
    amber: 'via-amber-500',
    rose: 'via-rose-500',
    cyan: 'via-cyan-500',
    emerald: 'via-emerald-500',
    violet: 'via-violet-500',
    blue: 'via-blue-500'
  };

  return (
    <div className={cn("relative p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 backdrop-blur-sm", className)}>
      <div className={cn("absolute -top-px left-10 right-10 h-px bg-gradient-to-r from-transparent to-transparent opacity-50", themeColors[theme] || 'via-amber-500')} />
      {title && <h3 className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3 font-semibold">{title}</h3>}
      {children}
    </div>
  );
};

const IconButton = ({ 
  icon: Icon, 
  label, 
  onClick, 
  className,
  active,
  theme = 'amber'
}: { 
  icon: any; 
  label: string; 
  onClick?: () => void; 
  className?: string;
  active?: boolean;
  theme?: string;
}) => {
  const activeStyles: Record<string, string> = {
    amber: "bg-amber-500/10 border-amber-500/30 text-amber-500",
    rose: "bg-rose-500/10 border-rose-500/30 text-rose-500",
    cyan: "bg-cyan-500/10 border-cyan-500/30 text-cyan-500",
    emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-500",
    violet: "bg-violet-500/10 border-violet-500/30 text-violet-500",
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-500",
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center p-4 rounded-2xl transition-all active:scale-95 group",
        active ? activeStyles[theme] || activeStyles.amber + " border" : "bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700",
        className
      )}
    >
      <Icon className={cn("w-6 h-6 mb-2 transition-colors", active ? "" : "text-zinc-400 group-hover:text-white")} />
      <span className={cn("text-[10px] uppercase tracking-widest font-bold", active ? "" : "text-zinc-500 group-hover:text-zinc-300")}>
        {label}
      </span>
    </button>
  );
};

// --- Pair Categories ---
const PAIR_CATEGORIES = {
  "FOREX MAJOR": ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD"],
  "FOREX MINOR": ["EURGBP", "EURJPY", "EURCHF", "EURAUD", "EURCAD", "EURNZD", "GBPJPY", "GBPCHF", "GBPAUD", "GBPCAD", "GBPNZD", "AUDJPY", "AUDCHF", "AUDCAD", "AUDNZD", "NZDJPY", "NZDCHF", "NZDCAD", "CADJPY", "CADCHF", "CHFJPY"],
  "FOREX EXOTIC": ["USDTRY", "USDZAR", "USDMXN", "USDSGD", "USDHKD", "USDNOK", "USDSEK", "USDPLN", "USDDKK", "USDCZK", "USDHUF", "EURTRY", "EURZAR", "EURNOK", "EURSEK", "EURPLN", "EURHUF", "GBPTRY", "GBPZAR"],
  "METALS": ["XAUUSD", "XAGUSD", "XAUEUR", "XAUGBP", "XPTUSD", "XPDUSD"],
  "CRYPTO": ["BTCUSD", "ETHUSD", "SOLUSD", "XRPUSD", "DOGEUSD"]
};

interface SystemAlert {
  id: string;
  symbol: string;
  type: 'PRICE' | 'RSI' | 'CONFIDENCE';
  condition: 'ABOVE' | 'BELOW';
  value: number;
  isActive: boolean;
  delivery: { inApp: boolean; email: boolean; push: boolean };
}

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING';
  timestamp: Date;
}

export default function App() {
  const [alerts, setAlerts] = useState<SystemAlert[]>(() => {
    const saved = localStorage.getItem('sniper_alerts');
    return saved ? JSON.parse(saved) : [];
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);

  const addNotification = (title: string, message: string, type: AppNotification['type'] = 'INFO') => {
    const newNotif = { id: Date.now().toString(), title, message, type, timestamp: new Date() };
    setNotifications(prev => [newNotif, ...prev].slice(0, 20));
    
    if (isSignalAudioEnabled) {
      speak(`System Alert: ${title}. ${message}`);
    }
  };

  useEffect(() => {
    localStorage.setItem('sniper_alerts', JSON.stringify(alerts));
  }, [alerts]);
  const [symbols, setSymbols] = useState<string[]>(() => {
    const saved = localStorage.getItem('sniper_symbols');
    return saved ? JSON.parse(saved) : ['XAUUSD', 'EURUSD', 'BTCUSD'];
  });

  const [alertForm, setAlertForm] = useState<{
    symbol: string;
    type: SystemAlert['type'];
    condition: SystemAlert['condition'];
    value: number;
  }>({
    symbol: 'XAUUSD',
    type: 'PRICE',
    condition: 'ABOVE',
    value: 2350
  });
  const [newSymbol, setNewSymbol] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [trades, setTrades] = useState<Trade[]>(() => {
    const saved = localStorage.getItem('sniper_trades');
    return saved ? JSON.parse(saved) : [];
  });
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isSignalAudioEnabled, setIsSignalAudioEnabled] = useState(() => {
    const saved = localStorage.getItem('sniper_signal_audio');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [ambientSound, setAmbientSound] = useState<string | null>(() => {
    return localStorage.getItem('sniper_ambient_sound') || null;
  });
  const [ambientVolume, setAmbientVolume] = useState(() => {
    const saved = localStorage.getItem('sniper_ambient_volume');
    return saved !== null ? Number(saved) : 0.3;
  });
  const [isAmbientPlaying, setIsAmbientPlaying] = useState(false);
  
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  const [activeTab, setActiveTab] = useState('home');
  const [scannerSymbol, setScannerSymbol] = useState('XAUUSD');

  const [news, setNews] = useState<NewsItem[]>([]);

  // News Generator
  useEffect(() => {
    const generateNews = () => {
      const headlines = [
        `Central Bank moves could impact ${scannerSymbol} yield`,
        `${scannerSymbol} shows strong resistance at key psychological level`,
        `Whale activity detected on ${scannerSymbol} institutional desks`,
        `Global microchip shortage affecting ${scannerSymbol} related stocks`,
        `Technical breakout imminent for ${scannerSymbol} on 4H chart`,
        `${scannerSymbol} volatility spikes following quarterly volatility report`,
        `Bullish divergence spotted on ${scannerSymbol} RSI index`,
        `Retail sentiment shifts toward short-selling ${scannerSymbol}`
      ];
      
      const newItem: NewsItem = {
        id: Math.random().toString(36).substr(2, 9),
        symbol: scannerSymbol,
        title: headlines[Math.floor(Math.random() * headlines.length)],
        source: ['WSJ', 'Bloomberg', 'Reuters', 'CryptoPanic', 'CNBC'][Math.floor(Math.random() * 5)],
        time: 'Just now',
        sentiment: Math.random() > 0.6 ? 'positive' : Math.random() > 0.4 ? 'negative' : 'neutral',
        url: 'https://finance.yahoo.com'
      };

      setNews(prev => [newItem, ...prev].slice(0, 10));
    };

    const interval = setInterval(generateNews, 15000); // New headline every 15s
    generateNews(); // Initial headline

    return () => clearInterval(interval);
  }, [scannerSymbol]);
  const [rsiValue, setRsiValue] = useState(50);
  const [currentPrice, setCurrentPrice] = useState(2300);
  const [priceTrend, setPriceTrend] = useState<'up' | 'down' | 'neutral'>('neutral');
  const [connectionStatus, setConnectionStatus] = useState('CONNECTED');
  const [riskPerTrade, setRiskPerTrade] = useState(1);
  const [useNotifications, setUseNotifications] = useState(true);
  const [botImageUrl, setBotImageUrl] = useState(() => {
    return localStorage.getItem('sniper_bot_image') || 'https://images.unsplash.com/photo-1546776310-eef45dd6d63c?q=80&w=1000&auto=format&fit=crop';
  });
  const [backgroundUrl, setBackgroundUrl] = useState(() => {
    return localStorage.getItem('sniper_bg_url') || '';
  });
  const [backgroundType, setBackgroundType] = useState<'image' | 'video'>(() => {
    return (localStorage.getItem('sniper_bg_type') as 'image' | 'video') || 'image';
  });
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('sniper_theme') || 'amber';
  });

  const THEMES = {
    amber: { name: 'Gold', color: '#f59e0b', text: 'text-amber-500', border: 'border-amber-500', bg: 'bg-amber-500', glow: 'shadow-amber-500/20' },
    rose: { name: 'Crimson', color: '#f43f5e', text: 'text-rose-500', border: 'border-rose-500', bg: 'bg-rose-500', glow: 'shadow-rose-500/20' },
    cyan: { name: 'Cyber', color: '#06b6d4', text: 'text-cyan-400', border: 'border-cyan-400', bg: 'bg-cyan-400', glow: 'shadow-cyan-400/20' },
    emerald: { name: 'Emerald', color: '#10b981', text: 'text-emerald-400', border: 'border-emerald-400', bg: 'bg-emerald-400', glow: 'shadow-emerald-400/20' },
    violet: { name: 'Violet', color: '#8b5cf6', text: 'text-violet-500', border: 'border-violet-500', bg: 'bg-violet-500', glow: 'shadow-violet-500/20' },
    blue: { name: 'Tech', color: '#3b82f6', text: 'text-blue-500', border: 'border-blue-500', bg: 'bg-blue-500', glow: 'shadow-blue-500/20' },
  };

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const AMBIENT_SOUNDS = [
    { name: 'Rain', url: 'https://assets.mixkit.co/sfx/preview/mixkit-rain-on-a-window-2442.mp3' },
    { name: 'Cyber Hub', url: 'https://assets.mixkit.co/sfx/preview/mixkit-computer-room-ambience-2469.mp3' },
    { name: 'Distant Storm', url: 'https://assets.mixkit.co/sfx/preview/mixkit-distant-thunder-and-rain-2404.mp3' },
    { name: 'Deep Space', url: 'https://assets.mixkit.co/sfx/preview/mixkit-deep-space-drone-2150.mp3' },
  ];

  const [showTradeDialog, setShowTradeDialog] = useState(false);
  const [executingTrade, setExecutingTrade] = useState(false);

  const handleExecuteTrade = async () => {
    if (!signals[0]) return;
    setExecutingTrade(true);
    speak(`Initiating ${signals[0].type} order for ${signals[0].symbol} at market price ${signals[0].price.toFixed(2)}.`);
    
    // Simulate execution lag
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setExecutingTrade(false);
    setShowTradeDialog(false);
    
    const logData = {
      id: Date.now().toString(),
      symbol: signals[0].symbol,
      type: signals[0].type,
      price: signals[0].price,
      tp: signals[0].tp,
      sl: signals[0].sl,
      status: 'EXECUTED',
      timestamp: new Date().toLocaleTimeString()
    };
    
    setTrades(prev => [logData as any, ...prev]);
    speak(`Order filled successfully. Tracking position.`);
    
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: [THEMES[theme as keyof typeof THEMES]?.color || '#f59e0b']
    });
  };

  const ai = useMemo(() => {
    if (!process.env.GEMINI_API_KEY) return null;
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }, []);

  // Ambient Audio Management
  useEffect(() => {
    if (ambientSound && isAmbientPlaying) {
      if (!ambientAudioRef.current) {
        ambientAudioRef.current = new Audio(ambientSound);
        ambientAudioRef.current.loop = true;
      } else if (ambientAudioRef.current.src !== ambientSound) {
        ambientAudioRef.current.src = ambientSound;
      }
      ambientAudioRef.current.volume = ambientVolume;
      ambientAudioRef.current.play().catch(e => {
        console.error("Audio block (User must interact first):", e);
        setIsAmbientPlaying(false);
      });
    } else {
      ambientAudioRef.current?.pause();
    }
    
    return () => {
      ambientAudioRef.current?.pause();
    };
  }, [ambientSound, isAmbientPlaying]);

  useEffect(() => {
    if (ambientAudioRef.current) {
      ambientAudioRef.current.volume = ambientVolume;
    }
    localStorage.setItem('sniper_ambient_volume', ambientVolume.toString());
    localStorage.setItem('sniper_ambient_sound', ambientSound || '');
  }, [ambientVolume, ambientSound]);

  // Sync symbols to local storage
  useEffect(() => {
    localStorage.setItem('sniper_symbols', JSON.stringify(symbols));
  }, [symbols]);

  useEffect(() => {
    localStorage.setItem('sniper_trades', JSON.stringify(trades));
  }, [trades]);

  useEffect(() => {
    localStorage.setItem('sniper_bot_image', botImageUrl);
  }, [botImageUrl]);

  useEffect(() => {
    localStorage.setItem('sniper_bg_url', backgroundUrl);
    localStorage.setItem('sniper_bg_type', backgroundType);
  }, [backgroundUrl, backgroundType]);

  useEffect(() => {
    localStorage.setItem('sniper_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('sniper_signal_audio', JSON.stringify(isSignalAudioEnabled));
  }, [isSignalAudioEnabled]);

  // Market Data Simulator for Scanner
  useEffect(() => {
    if (activeTab === 'scanner') {
      const interval = setInterval(() => {
        setRsiValue(prevRsi => {
          const change = (Math.random() - 0.5) * 4;
          const nextRsi = Math.min(Math.max(prevRsi + change, 10), 90);
          
          // RSI Alerts
          alerts.filter(a => a.isActive && a.type === 'RSI' && a.symbol === scannerSymbol).forEach(alert => {
            if (alert.condition === 'ABOVE' && nextRsi > alert.value && prevRsi <= alert.value) {
              addNotification(`RSI Over ${alert.value}`, `${alert.symbol} momentum is extreme.`, 'WARNING');
            } else if (alert.condition === 'BELOW' && nextRsi < alert.value && prevRsi >= alert.value) {
              addNotification(`RSI Under ${alert.value}`, `${alert.symbol} momentum is cooling.`, 'INFO');
            }
          });
          return nextRsi;
        });
        setCurrentPrice(prevPrice => {
          const change = (Math.random() - 0.5) * (prevPrice * 0.0005);
          const nextPrice = prevPrice + change;
          
          if (change > 0) setPriceTrend('up');
          else if (change < 0) setPriceTrend('down');

          // Price Alerts
          alerts.filter(a => a.isActive && a.type === 'PRICE' && a.symbol === scannerSymbol).forEach(alert => {
            if (alert.condition === 'ABOVE' && nextPrice > alert.value && prevPrice <= alert.value) {
              addNotification(`Target Reached`, `${alert.symbol} hit price target ${alert.value}`, 'SUCCESS');
            } else if (alert.condition === 'BELOW' && nextPrice < alert.value && prevPrice >= alert.value) {
              addNotification(`Support Broken`, `${alert.symbol} dropped below ${alert.value}`, 'WARNING');
            }
          });

          return nextPrice;
        });
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [activeTab, scannerSymbol]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'bg') => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (type === 'avatar') {
        setBotImageUrl(result);
      } else {
        setBackgroundUrl(result);
        setBackgroundType(file.type.startsWith('video/') ? 'video' : 'image');
      }
    };
    reader.readAsDataURL(file);
  };

  // AI Voice Synthesizer using Gemini TTS
  const speak = async (text: string) => {
    if (!isVoiceEnabled || !ai) {
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = 1.1;
      utterance.rate = 0.9;
      synth.speak(utterance);
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: `In a futuristic female AI voice, say: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
        audio.play().catch(e => console.error("Audio playback failed", e));
      }
    } catch (error) {
      console.error("Gemini TTS failed, falling back to local TTS:", error);
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      synth.speak(utterance);
    }
  };

  const processSignalOutcome = (signal: Signal) => {
    setTimeout(() => {
      const isProfit = Math.random() > 0.3;
      const exitPrice = isProfit ? signal.tp : signal.sl;
      const pl = isProfit ? (Math.random() * 50 + 20) : -(Math.random() * 30 + 10);
      
      const newTrade: Trade = {
        id: signal.id,
        symbol: signal.symbol,
        type: signal.type,
        entryPrice: signal.price,
        exitPrice: exitPrice,
        tp: signal.tp,
        sl: signal.sl,
        pl: pl,
        status: isProfit ? 'PROFIT' : 'LOSS',
        duration: `${Math.floor(Math.random() * 45 + 15)}m`,
        timestamp: Date.now(),
        broker: signal.broker
      };

      setTrades(prev => [newTrade, ...prev].slice(0, 50));
      speak(`Trade closed for ${newTrade.symbol}. Result: ${newTrade.status}. Total ${newTrade.status === 'PROFIT' ? 'gain' : 'drawdown'} of ${Math.abs(pl).toFixed(2)} pips.`);
    }, 5000 + Math.random() * 5000);
  };

  const generateSignal = async () => {
    if (symbols.length === 0) {
      speak("No symbols selected for analysis.");
      return;
    }

    const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
    const broker = Math.random() > 0.5 ? 'JustMarkets' : 'Exness';
    
    // Simulated Sophisticated Factors
    const volatility = Math.random() * 100;
    const orderBookBalance = Math.random() * 2 - 1; // -1 to 1
    const liquidity = Math.random() * 100;
    const symbolTrades = trades.filter(t => t.symbol === randomSymbol);
    const successRate = symbolTrades.length > 0 
      ? (symbolTrades.filter(t => t.status === 'PROFIT').length / symbolTrades.length) * 100 
      : 0;
    const currentRsi = scannerSymbol === randomSymbol ? rsiValue : 50 + (Math.random() - 0.5) * 20;

    const marketContext = {
      volatility: volatility > 75 ? 'EXTREME' : volatility < 25 ? 'MINIMAL' : 'MODERATE',
      orderBook: orderBookBalance > 0.5 ? 'HEAVY BUY WALLS' : orderBookBalance < -0.5 ? 'HEAVY SELL PRESSURE' : 'BALANCED DEPTH',
      liquidity: liquidity > 80 ? 'ULTRA DEEP' : liquidity < 30 ? 'THICKENING' : 'SUFFICIENT',
      historicalAccuracy: successRate > 0 ? `${successRate.toFixed(1)}%` : 'N/A (NEW PATTERN)',
      rsi: currentRsi.toFixed(1)
    };

    try {
      const response = await ai!.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Act as a professional forex/crypto sniper entry engine for ${broker} terminals. 
        Analyze the following market context for ${randomSymbol}:
        - Volatility Index: ${marketContext.volatility}
        - Order Book Depth: ${marketContext.orderBook}
        - Liquidity Level: ${marketContext.liquidity}
        - Pair Historical Performance: ${marketContext.historicalAccuracy}
        - Current RSI (14): ${marketContext.rsi}
        
        Using these factors, generate a high-precision signal. Calculate the confidence score (0-100) based on factor confluence.
        If factors are conflicting (e.g. Overbought RSI but Heavy Buy Walls), adjust confidence lower to reflect market indecision.
        
        Return ONLY a JSON object: { "type": "BUY" | "SELL", "price": number, "tp": number, "sl": number, "confidence": number, "reasoning": "One sentence technical justification" }`
      });

      const data = JSON.parse(response.text || '{}');
      
      const newSignal: Signal = {
        id: Math.random().toString(36).substr(2, 9),
        symbol: randomSymbol,
        type: data.type || (Math.random() > 0.5 ? 'BUY' : 'SELL'),
        price: data.price || (randomSymbol === 'XAUUSD' ? 2300 + Math.random() * 100 : 1.05 + Math.random() * 0.1),
        tp: data.tp || (data.type === 'BUY' ? (data.price || 2300) + 20 : (data.price || 2300) - 20),
        sl: data.sl || (data.type === 'BUY' ? (data.price || 2300) - 15 : (data.price || 2300) + 15),
        confidence: data.confidence || 85,
        timestamp: Date.now(),
        broker,
        reasoning: data.reasoning
      };

      setSignals(prev => [newSignal, ...prev].slice(0, 50));
      processSignalOutcome(newSignal);

      // Confidence Alerts
      alerts.filter(a => a.isActive && a.type === 'CONFIDENCE').forEach(alert => {
        if (alert.condition === 'ABOVE' && newSignal.confidence > alert.value) {
          addNotification('High Confidence Signal', `${newSignal.symbol} ${newSignal.type} @ ${newSignal.confidence.toFixed(1)}%`, 'SUCCESS');
        }
      });
      
      if (isSignalAudioEnabled) {
        speak(`Attention. New ${newSignal.type} signal for ${newSignal.symbol}. Confidence is ${newSignal.confidence.toFixed(1)} percent. Analysis indicates ${newSignal.reasoning || 'favorable market conditions'}.`);
      } else {
        speak(`New signal for ${newSignal.symbol}. ${newSignal.type} detected.`);
      }

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#ffffff', '#22d3ee']
      });
      
    } catch (error) {
      console.error("Signal generation failed:", error);
    }
  };

  useEffect(() => {
    let interval: any;
    if (isScanning) {
      interval = setInterval(generateSignal, 8000);
    }
    return () => clearInterval(interval);
  }, [isScanning, symbols, isVoiceEnabled]);

  const toggleSymbol = (s: string) => {
    if (symbols.includes(s)) {
      setSymbols(symbols.filter(item => item !== s));
    } else {
      setSymbols([...symbols, s]);
    }
  };

  const addManualSymbol = () => {
    if (newSymbol && !symbols.includes(newSymbol.toUpperCase())) {
      setSymbols([...symbols, newSymbol.toUpperCase()]);
      setNewSymbol('');
    }
  };

  const getConfidenceColor = (conf: number) => {
    if (conf >= 90) return "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]";
    if (conf >= 80) return "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]";
    return "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]";
  };

  const getThemeClass = (type: 'text' | 'bg' | 'border' | 'glow', customTheme?: string) => {
    const t = (customTheme || theme) as keyof typeof THEMES;
    return THEMES[t]?.[type] || THEMES.amber[type];
  };

  return (
    <div className={cn("min-h-screen bg-[#050505] text-white font-sans overflow-hidden flex flex-col relative", `selection:${getThemeClass('bg')}/30`)}>
      {/* Dynamic Background Layer */}
      <AnimatePresence>
        {backgroundUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
          >
            {backgroundType === 'video' ? (
              <video 
                src={backgroundUrl} 
                autoPlay 
                loop 
                muted 
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img 
                src={backgroundUrl} 
                alt="Background" 
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-[#050505]/60 backdrop-blur-[2px]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden File Inputs */}
      <input 
        type="file" 
        ref={avatarInputRef} 
        hidden 
        accept="image/*" 
        onChange={(e) => handleFileUpload(e, 'avatar')} 
      />
      <input 
        type="file" 
        ref={bgInputRef} 
        hidden 
        accept="image/*,video/*" 
        onChange={(e) => handleFileUpload(e, 'bg')} 
      />

      {/* API Key Warning */}
      {!process.env.GEMINI_API_KEY && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-600 text-white text-[10px] font-bold py-1 px-4 text-center uppercase tracking-widest animate-pulse">
          WARNING: GEMINI_API_KEY IS NOT CONFIGURED. AI FEATURES DISABLED.
        </div>
      )}

      {/* Header */}
      <header className="p-6 flex items-center justify-between border-b border-zinc-900/50 z-10 transition-colors">
        <div>
          <h1 className="text-xl font-black tracking-tighter flex items-center gap-2">
            SNIPER PRO <span className={getThemeClass('text')}>3.0</span>
          </h1>
          <p className="text-[10px] text-zinc-500 tracking-wider uppercase mt-0.5">
            AI Sniper Engine • System Status: <span className="text-emerald-500">Live</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowNotificationCenter(!showNotificationCenter)}
            className={cn(
              "w-10 h-10 rounded-full border flex items-center justify-center transition-all relative group",
              notifications.length > 0 ? cn(getThemeClass('border'), getThemeClass('text')) : "border-zinc-800 text-zinc-600"
            )}
          >
            <Bell size={18} />
            {notifications.length > 0 && (
              <span className={cn("absolute -top-1 -right-1 w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center", getThemeClass('bg'), "text-black border-2 border-[#050505]")}>
                {notifications.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
            className={cn(
              "w-10 h-10 rounded-full border flex items-center justify-center transition-all",
              isVoiceEnabled ? cn(getThemeClass('border'), getThemeClass('text'), "shadow-lg") : "border-zinc-800 text-zinc-600"
            )}
          >
            {isVoiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
      </header>

      {/* Notification Center Overlay */}
      <AnimatePresence>
        {showNotificationCenter && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed top-24 right-4 left-4 sm:left-auto sm:w-80 z-[100] bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden max-h-[70vh] flex flex-col"
          >
            <div className="p-4 border-b border-zinc-900 flex justify-between items-center bg-zinc-900/50">
              <h3 className="text-[10px] font-black uppercase tracking-widest">Notification Stack</h3>
              <button onClick={() => setNotifications([])} className="text-[8px] font-black uppercase text-rose-500 hover:text-rose-400">Clear All</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-zinc-600 text-[10px] uppercase font-bold tracking-widest">No active alerts</div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className="p-3 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 space-y-1">
                    <div className="flex justify-between items-start">
                      <span className={cn(
                        "text-[9px] font-black uppercase",
                        n.type === 'SUCCESS' ? "text-emerald-500" : n.type === 'WARNING' ? "text-rose-500" : getThemeClass('text')
                      )}>{n.title}</span>
                      <span className="text-[7px] text-zinc-600 font-mono">{n.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-relaxed font-medium">{n.message}</p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        {/* Visual Bot Display */}
        {activeTab === 'home' && (
          <div className="relative aspect-square w-full max-w-[400px] mx-auto group">
            <div className={cn("absolute inset-0 rounded-[2rem] blur-2xl opacity-20", getThemeClass('bg'))} />
            
            <div className={cn(
              "relative w-full h-full rounded-[2.5rem] border-2 overflow-hidden transition-all duration-700",
              isScanning ? cn(getThemeClass('border'), "shadow-2xl shadow-current") : "border-zinc-800/50"
            )}>
              <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center">
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 opacity-40">
                    <div className={cn("w-full h-full border rounded-xl relative overflow-hidden", getThemeClass('border').replace('border-', 'border-') + "/20")}>
                      <motion.div 
                        animate={{ y: ['0%', '100%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className={cn("absolute top-0 left-0 right-0 h-px", getThemeClass('bg'))}
                      />
                    </div>
                </div>
                
                <div className="relative w-full h-full flex items-center justify-center p-4">
                    <motion.div
                      animate={isScanning ? { scale: [1, 1.02, 1] } : {}}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className="relative w-full h-full"
                    >
                      <img 
                        src={botImageUrl} 
                        alt="Sniper Bot"
                        className={cn(
                          "w-full h-full object-cover rounded-3xl transition-all duration-500",
                          isScanning ? "brightness-125 contrast-110" : "brightness-50 opacity-40 grayscale"
                        )}
                        referrerPolicy="no-referrer"
                      />
                      <div className={cn(
                        "absolute inset-0 rounded-3xl transition-opacity duration-500",
                        isScanning ? cn(getThemeClass('bg'), "mix-blend-overlay opacity-20") : "opacity-0"
                      )} />
                    </motion.div>
                    
                    <div className={cn(
                      "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 blur-[80px] rounded-full transition-colors duration-1000",
                      isScanning ? cn(getThemeClass('bg'), "opacity-30") : "bg-transparent"
                    )} />
                </div>

                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", isScanning ? "bg-cyan-400 animate-pulse" : "bg-zinc-800")} />
                  <span className={cn("text-[10px] tracking-widest font-black uppercase", isScanning ? "text-cyan-400" : "text-zinc-600")}>
                      {connectionStatus}
                  </span>
                </div>
              </div>

              <div className={cn("absolute top-6 left-6 w-4 h-4 border-t-2 border-l-2", getThemeClass('border'))} />
              <div className={cn("absolute top-6 right-6 w-4 h-4 border-t-2 border-r-2", getThemeClass('border'))} />
              <div className={cn("absolute bottom-6 left-6 w-4 h-4 border-b-2 border-l-2", getThemeClass('border'))} />
              <div className={cn("absolute bottom-6 right-6 w-4 h-4 border-b-2 border-r-2", getThemeClass('border'))} />
            </div>
          </div>
        )}

        {/* Quick Action Grid */}
        <div className="grid grid-cols-3 gap-3 max-w-[400px] mx-auto">
          <IconButton icon={Layers} label="Pair" onClick={() => setActiveTab('symbols')} active={activeTab === 'symbols'} theme={theme} />
          <IconButton icon={isScanning ? Zap : Play} label={isScanning ? "STOP" : "START"} 
            onClick={() => { setIsScanning(!isScanning); speak(isScanning ? "Scanning halted." : "Bot initialized. Searching for sniper entries."); }}
            className={isScanning ? cn(getThemeClass('glow'), "shadow-lg bg-opacity-20 border-opacity-50") : ""} theme={theme} />
          <IconButton icon={FileText} label="Log" onClick={() => setActiveTab('logs')} active={activeTab === 'logs' || activeTab === 'history'} theme={theme} />
        </div>

        {/* Dynamic Content Sections */}
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <NeonCard className="bg-gradient-to-br from-amber-500/10 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-950 flex items-center justify-center border border-amber-500/30">
                      <Target size={18} className="text-amber-500" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-tight">Sniper Pro 3.0</h4>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Tracking • {symbols.length} Pairs Active</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-zinc-700" />
                </div>
              </NeonCard>

              {signals.length > 0 && (
                <NeonCard title="Signal Engine v3.0 Alpha" theme={theme}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl font-black italic">{signals[0].symbol}</span>
                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest", signals[0].type === 'BUY' ? "bg-emerald-500 text-black" : "bg-rose-500 text-black")}>
                          {signals[0].type}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Entry: <span className="text-zinc-200">{signals[0].price.toFixed(2)}</span></div>
                    </div>
                    <div className="text-right">
                      <div className="text-zinc-500 text-[8px] font-black uppercase tracking-widest mb-1 italic">R:R Ratio: <span className="text-zinc-200">1:{(Math.abs(signals[0].tp - signals[0].price) / Math.abs(signals[0].price - signals[0].sl)).toFixed(1)}</span></div>
                      <div className="flex flex-col gap-0.5">
                        <div className="text-emerald-400 text-xs font-black">TP: {signals[0].tp.toFixed(2)}</div>
                        <div className="text-rose-500 text-xs font-black">SL: {signals[0].sl.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>

                  {/* P/L Zones Visualization */}
                  <div className="mb-6 space-y-3">
                    <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-zinc-500">
                      <span>Loss Zone</span>
                      <span>Target Profit</span>
                    </div>
                    <div className="relative h-6 w-full rounded-xl overflow-hidden bg-zinc-950 border border-zinc-900 flex">
                      {signals[0].type === 'BUY' ? (
                        <>
                          <div className="h-full bg-rose-500/20 border-r border-rose-500/50 flex-1 flex items-center justify-center">
                            <span className="text-[8px] font-black text-rose-500/60">RISK ZONE</span>
                          </div>
                          <div className="h-full bg-emerald-500/20 flex-[2] flex items-center justify-center">
                            <span className="text-[8px] font-black text-emerald-500/60">REWARD ZONE</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="h-full bg-emerald-500/20 border-r border-emerald-500/50 flex-[2] flex items-center justify-center">
                            <span className="text-[8px] font-black text-emerald-500/60">REWARD ZONE</span>
                          </div>
                          <div className="h-full bg-rose-500/20 flex-1 flex items-center justify-center">
                            <span className="text-[8px] font-black text-rose-500/60">RISK ZONE</span>
                          </div>
                        </>
                      )}
                      
                      {/* Entry Price Indicator Marker */}
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={cn(
                          "absolute top-0 bottom-0 w-0.5 bg-white z-10",
                          signals[0].type === 'BUY' ? "left-[33.3%]" : "left-[66.6%]"
                        )}
                      >
                         <div className="absolute -top-1 -left-[3px] w-2 h-2 bg-white rounded-full" />
                         <div className="absolute -bottom-1 -left-[3px] w-2 h-2 bg-white rounded-full" />
                      </motion.div>
                    </div>
                    <div className="flex justify-between px-1">
                      <div className="text-[9px] font-black text-rose-500 italic">-{Math.abs(signals[0].price - signals[0].sl).toFixed(2)} PIPS</div>
                      <div className="text-[9px] font-black text-emerald-500 italic">+{Math.abs(signals[0].tp - signals[0].price).toFixed(2)} PIPS</div>
                    </div>
                  </div>

                  {/* Enhanced Confidence Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 italic">Entry Confidence</span>
                      <span className={cn("text-xs font-black", signals[0].confidence >= 80 ? "text-emerald-400" : "text-amber-400")}>{signals[0].confidence.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-900">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${signals[0].confidence}%` }}
                        className={cn("h-full transition-all duration-1000", getConfidenceColor(signals[0].confidence))}
                      />
                    </div>
                    {signals[0].reasoning && (
                      <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider mt-2 line-clamp-1 border-l border-zinc-800 pl-2 italic">
                        {signals[0].reasoning}
                      </p>
                    )}
                  </div>

                  <div className="mt-6">
                    <button 
                      onClick={() => setShowTradeDialog(true)}
                      className={cn(
                        "w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all active:scale-[0.98] shadow-lg",
                        signals[0].type === 'BUY' ? "bg-emerald-500 text-black hover:bg-emerald-400" : "bg-rose-500 text-black hover:bg-rose-400"
                      )}
                    >
                      Execute {signals[0].type} Trade
                    </button>
                  </div>
                </NeonCard>
              )}
            </motion.div>
          )}

          {/* Trade Confirmation Dialog */}
          <AnimatePresence>
            {showTradeDialog && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[110] flex items-center justify-center p-6"
              >
                <div className="absolute inset-0 bg-[#050505]/95 backdrop-blur-xl" />
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  className="relative w-full max-w-sm p-6 rounded-[2.5rem] bg-zinc-900/50 border border-zinc-800 backdrop-blur-md shadow-2xl overflow-hidden"
                >
                  <div className={cn("absolute -top-px left-10 right-10 h-px bg-gradient-to-r from-transparent to-transparent opacity-50", getThemeClass('bg'))} />
                  
                  <div className="mb-6 text-center">
                    <div className="inline-flex p-3 rounded-full bg-zinc-950 mb-4 border border-zinc-900">
                      <Zap className={cn("w-6 h-6", signals[0]?.type === 'BUY' ? "text-emerald-500" : "text-rose-500")} />
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-widest italic mb-1">Confirm Execution</h3>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest leading-relaxed">
                      You are about to execute a {signals[0]?.type} order for {signals[0]?.symbol} on your connected terminal.
                    </p>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="p-4 rounded-2xl bg-zinc-950/50 border border-zinc-800/50 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-[8px] font-black uppercase text-zinc-600">Asset</span>
                        <span className="text-[10px] font-black">{signals[0]?.symbol}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[8px] font-black uppercase text-zinc-600">Type</span>
                        <span className={cn("text-[10px] font-black", signals[0]?.type === 'BUY' ? "text-emerald-500" : "text-rose-500")}>{signals[0]?.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[8px] font-black uppercase text-zinc-600">Price</span>
                        <span className="text-[10px] font-black font-mono">@{signals[0]?.price.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={handleExecuteTrade}
                      disabled={executingTrade}
                      className={cn(
                        "w-full py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] transition-all relative overflow-hidden",
                        signals[0]?.type === 'BUY' ? "bg-emerald-500 text-black" : "bg-rose-500 text-black"
                      )}
                    >
                      {executingTrade ? (
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full mx-auto"
                        />
                      ) : (
                        "PROCEED WITH ORDER"
                      )}
                    </button>
                    <button 
                      onClick={() => setShowTradeDialog(false)}
                      disabled={executingTrade}
                      className="w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      ABORT TRANSACTION
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {activeTab === 'symbols' && (
            <motion.div key="symbols" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="flex gap-2">
                <input type="text" value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} placeholder="ADD CUSTOM SYMBOL..." className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest focus:border-amber-500 outline-none" onKeyDown={(e) => e.key === 'Enter' && addManualSymbol()} />
                <button onClick={addManualSymbol} className="bg-amber-500 text-black p-3 rounded-xl active:scale-95 transition-transform"><Plus size={20} /></button>
              </div>

              {Object.entries(PAIR_CATEGORIES).map(([category, pairs]) => (
                <div key={category} className="space-y-3">
                  <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-amber-500/80 ml-1">{category}</h3>
                  <div className="flex flex-wrap gap-2">
                    {pairs.map(p => (
                      <button 
                        key={p} 
                        onClick={() => toggleSymbol(p)}
                        className={cn(
                          "px-4 py-2.5 rounded-full text-[10px] font-black tracking-widest uppercase border transition-all duration-300",
                          symbols.includes(p) 
                            ? "bg-amber-500/10 border-amber-500 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)] scale-105" 
                            : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                        )}
                      >
                        {symbols.includes(p) && "✓ "} {p}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'logs' && (
             <motion.div key="logs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
                  <button onClick={() => setActiveTab('logs')} className="flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all bg-amber-500 text-black shadow-lg shadow-amber-500/20">Signals</button>
                  <button onClick={() => setActiveTab('history')} className="flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all text-zinc-500 hover:text-zinc-300">Trade Results</button>
                </div>
                <div className="space-y-3">
                  {signals.map(s => (
                    <div key={s.id} className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {s.type === 'BUY' ? <TrendingUp size={16} className="text-emerald-500" /> : <TrendingDown size={16} className="text-rose-500" />}
                        <div>
                          <div className="text-sm font-bold">{s.symbol}</div>
                          <div className="text-[8px] text-zinc-600 uppercase font-black tracking-widest leading-tight">
                            {new Date(s.timestamp).toLocaleTimeString()} • {s.broker}
                            {s.reasoning && <span className="block text-zinc-500 font-bold lowercase mt-0.5 normal-case italic text-[7px]">{s.reasoning}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-mono">{s.price.toFixed(2)}</div>
                        <div className="text-[10px] font-bold text-amber-500/50">{s.confidence.toFixed(1)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
             </motion.div>
          )}

          {activeTab === 'history' && (
             <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
                  <button onClick={() => setActiveTab('logs')} className="flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all text-zinc-500 hover:text-zinc-300">Signals</button>
                  <button onClick={() => setActiveTab('history')} className="flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all bg-amber-500 text-black shadow-lg shadow-amber-500/20">Trade Results</button>
                </div>
                <div className="space-y-3">
                  {trades.length === 0 ? (
                    <div className="p-8 text-center text-zinc-700 border-2 border-dashed border-zinc-900 rounded-3xl uppercase text-[10px] tracking-widest font-black">
                      Execution History Clear
                    </div>
                  ) : (
                    trades.map(t => (
                      <NeonCard key={t.id} className={cn(t.status === 'PROFIT' ? "border-emerald-500/20" : "border-rose-500/20")}>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-2">
                             <div className={cn("w-2 h-2 rounded-full", t.status === 'PROFIT' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]")} />
                             <span className="font-black text-sm">{t.symbol}</span>
                             <span className={cn("text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest", t.type === 'BUY' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400")}>{t.type}</span>
                          </div>
                          <div className={cn("text-xs font-black font-mono", t.status === 'PROFIT' ? "text-emerald-400" : "text-rose-400")}>{t.pl > 0 ? '+' : ''}{t.pl.toFixed(2)} PIPS</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <div className="text-zinc-600 text-[8px] font-black uppercase tracking-widest">Entry: <span className="text-zinc-300">{t.entryPrice.toFixed(2)}</span></div>
                            <div className="text-zinc-600 text-[8px] font-black uppercase tracking-widest">Exit: <span className="text-zinc-300">{t.exitPrice.toFixed(2)}</span></div>
                          </div>
                          <div className="text-right">
                            <div className="text-[8px] text-zinc-600 uppercase font-black tracking-widest">Duration</div>
                            <div className="text-xs font-black text-zinc-300">{t.duration}</div>
                          </div>
                        </div>
                      </NeonCard>
                    ))
                  )}
                </div>
             </motion.div>
          )}

          {activeTab === 'scanner' && (
            <motion.div key="scanner" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="h-full flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <h2 className={cn("text-[10px] font-black uppercase tracking-[0.4em] ml-1 opacity-60", getThemeClass('text'))}>Live Market Scanner</h2>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-[8px] font-black uppercase text-zinc-500">Real-Time Data Feed</span>
                </div>
              </div>

              {/* Dynamic Symbol Selection for Scanner */}
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {symbols.map(sym => (
                  <button 
                    key={sym}
                    onClick={() => setScannerSymbol(sym)}
                    className={cn(
                      "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border",
                      scannerSymbol === sym 
                        ? cn(getThemeClass('border'), getThemeClass('text'), "bg-white/5 shadow-sm scale-105") 
                        : "border-zinc-800 text-zinc-600 hover:border-zinc-700"
                    )}
                  >
                    {sym}
                  </button>
                ))}
                {symbols.length === 0 && (
                  <button 
                    onClick={() => setActiveTab('symbols')}
                    className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-dashed border-zinc-800 text-zinc-700"
                  >
                    + Add Symbols to Scan
                  </button>
                )}
              </div>

              <div className="flex-1 min-h-[450px] rounded-[2rem] overflow-hidden border border-zinc-800 bg-zinc-950 relative group">
                <TradingViewWidget symbol={scannerSymbol} />
                {/* Advanced Overlay HUD */}
                <div className="absolute top-4 left-4 right-4 pointer-events-none flex justify-between items-start z-10">
                   <motion.div 
                     initial={{ x: -20, opacity: 0 }}
                     animate={{ x: 0, opacity: 1 }}
                     className="p-3 rounded-2xl bg-black/80 backdrop-blur-md border border-white/5 space-y-1 relative overflow-hidden"
                   >
                      <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live Feed
                      </div>
                      <div className="flex items-center gap-2">
                        <motion.div 
                          key={currentPrice}
                          initial={{ scale: 1.1 }}
                          animate={{ scale: 1 }}
                          className={cn("text-lg font-black font-mono tracking-tighter", priceTrend === 'up' ? "text-emerald-400" : "text-rose-400")}
                        >
                          {currentPrice.toFixed(2)}
                        </motion.div>
                        {priceTrend === 'up' ? <TrendingUp size={14} className="text-emerald-400" /> : <TrendingDown size={14} className="text-rose-400" />}
                      </div>
                      {/* Pulsating background ring for price */}
                      <motion.div 
                        key={`pulse-${currentPrice}`}
                        initial={{ scale: 0.8, opacity: 0.5 }}
                        animate={{ scale: 2, opacity: 0 }}
                        className={cn("absolute inset-0 rounded-full border-2 pointer-events-none", priceTrend === 'up' ? "border-emerald-500/30" : "border-rose-500/30")}
                      />
                   </motion.div>

                   <motion.div 
                     initial={{ x: 20, opacity: 0 }}
                     animate={{ x: 0, opacity: 1 }}
                     className="p-3 rounded-2xl bg-black/80 backdrop-blur-md border border-white/5 flex flex-col items-end"
                   >
                      <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Sentiment Index</div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-[7px] text-zinc-600 font-black uppercase">RSI (14)</div>
                          <div className={cn(
                            "text-sm font-black font-mono",
                            rsiValue > 70 ? "text-rose-500" : rsiValue < 30 ? "text-emerald-500" : "text-zinc-200"
                          )}>
                            {rsiValue.toFixed(1)}
                          </div>
                        </div>
                        <div className="w-px h-6 bg-zinc-800" />
                        <div className="text-right">
                          <div className="text-[7px] text-zinc-600 font-black uppercase">MA (50)</div>
                          <div className={cn(
                            "text-sm font-black font-mono",
                            currentPrice > (currentPrice * 0.99) ? "text-emerald-400" : "text-rose-400"
                          )}>
                            {(currentPrice * 0.998).toFixed(2)}
                          </div>
                        </div>
                      </div>
                   </motion.div>
                </div>

                <div className="absolute bottom-4 left-4 right-4 pointer-events-none flex flex-col gap-3 z-10">
                   <div className="flex justify-between items-end">
                      <motion.div 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="p-3 rounded-2xl bg-black/80 backdrop-blur-md border border-white/5 space-y-1"
                      >
                         <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Active Analysis</div>
                         <div className="text-xs font-black italic flex items-center gap-2">
                           {scannerSymbol} <span className="text-zinc-700">|</span> 15M <span className="text-zinc-700">|</span> <span className={getThemeClass('text')}>ALGO-V3</span>
                         </div>
                      </motion.div>

                      <motion.div 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="p-3 rounded-2xl bg-black/80 backdrop-blur-md border border-white/5 flex gap-4"
                      >
                         <div className="flex flex-col items-center">
                            <div className="text-[7px] font-black text-emerald-500 uppercase tracking-tighter">Buy Volume</div>
                            <div className="text-xs font-black">{(50 + (50 - rsiValue) / 2).toFixed(1)}%</div>
                         </div>
                         <div className="w-px h-8 bg-zinc-800" />
                         <div className="flex flex-col items-center">
                            <div className="text-[7px] font-black text-rose-500 uppercase tracking-tighter">Sell Volume</div>
                            <div className="text-xs font-black">{(100 - (50 + (50 - rsiValue) / 2)).toFixed(1)}%</div>
                         </div>
                      </motion.div>
                   </div>

                   {/* Volume Power Meter */}
                   <motion.div 
                     initial={{ scaleX: 0 }}
                     animate={{ scaleX: 1 }}
                     className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/50 flex"
                   >
                     <motion.div 
                       animate={{ width: `${50 + (50 - rsiValue) / 2}%` }}
                       className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                     />
                     <motion.div 
                       animate={{ width: `${100 - (50 + (50 - rsiValue) / 2)}%` }}
                       className="h-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]" 
                     />
                   </motion.div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <NeonCard title="Market Intelligence" theme={theme}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Newspaper size={14} className={getThemeClass('text')} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Global Feed: {scannerSymbol}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[8px] font-black uppercase text-zinc-600">Terminal Connected</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {news.filter(n => n.symbol === scannerSymbol).slice(0, 4).map((item, idx) => (
                        <motion.a 
                          key={item.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex flex-col p-4 rounded-2xl bg-zinc-950/50 border border-zinc-800/50 hover:border-zinc-700/50 transition-all active:scale-[0.98] relative overflow-hidden"
                        >
                          <div className={cn("absolute top-0 left-0 w-1 h-full opacity-30", 
                            item.sentiment === 'positive' ? "bg-emerald-500" : item.sentiment === 'negative' ? "bg-rose-500" : "bg-zinc-500"
                          )} />
                          <div className="flex justify-between items-start mb-2 pl-2">
                            <span className="text-[8px] font-black uppercase text-zinc-600 tracking-widest">{item.source}</span>
                            <span className="text-[7px] font-black uppercase text-zinc-700">{item.time}</span>
                          </div>
                          <h4 className="text-[11px] font-bold leading-tight mb-2 pl-2 group-hover:text-white transition-colors">
                            {item.title}
                          </h4>
                          <div className="pl-2 mt-auto flex items-center gap-1">
                            <span className="text-[8px] font-black uppercase text-zinc-500">Read Analysis</span>
                            <ExternalLink size={8} className="text-zinc-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                          </div>
                        </motion.a>
                      ))}
                      {news.filter(n => n.symbol === scannerSymbol).length === 0 && (
                        <div className="col-span-full py-8 flex flex-col items-center justify-center opacity-30 border border-dashed border-zinc-800 rounded-3xl">
                          <Newspaper size={24} className="mb-2" />
                          <p className="text-[8px] font-black uppercase tracking-[0.2em]">Aggregating sym-linked data...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </NeonCard>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <NeonCard theme={theme}>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Bullish Alpha</span>
                  </div>
                  <div className={cn("text-xl font-black italic", getThemeClass('text'))}>
                    {(100 - rsiValue).toFixed(0)}% <span className="text-[8px] text-zinc-600 uppercase not-italic ml-1">Confidence</span>
                  </div>
                </NeonCard>
                <NeonCard theme={theme}>
                  <div className="flex items-center gap-2 mb-2">
                    <Activity size={14} className="text-blue-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Market Pulse</span>
                  </div>
                  <div className="text-xl font-black italic text-cyan-400">
                    {rsiValue > 70 || rsiValue < 30 ? "VOLATILE" : "STABLE"} <span className="text-[8px] text-zinc-600 uppercase not-italic ml-1">Conditions</span>
                  </div>
                </NeonCard>
              </div>
            </motion.div>
          )}

          {activeTab === 'alerts' && (
            <motion.div key="alerts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <h2 className={cn("text-[10px] font-black uppercase tracking-[0.4em] ml-1 opacity-60", getThemeClass('text'))}>Alert System</h2>
              
              <NeonCard title="Create New Trigger" theme={theme}>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Symbol</label>
                      <select 
                        value={alertForm.symbol}
                        onChange={(e) => setAlertForm({...alertForm, symbol: e.target.value})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 text-[10px] font-black outline-none focus:border-amber-500"
                      >
                        {symbols.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Alert Type</label>
                      <select 
                        value={alertForm.type}
                        onChange={(e) => setAlertForm({...alertForm, type: e.target.value as any})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 text-[10px] font-black outline-none focus:border-amber-500"
                      >
                        <option value="PRICE">PRICE LEVEL</option>
                        <option value="RSI">RSI INDEX</option>
                        <option value="CONFIDENCE">SIGNAL CONFIDENCE</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Condition</label>
                      <select 
                        value={alertForm.condition}
                        onChange={(e) => setAlertForm({...alertForm, condition: e.target.value as any})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 text-[10px] font-black outline-none focus:border-amber-500"
                      >
                        <option value="ABOVE">CROSS ABOVE / OVER</option>
                        <option value="BELOW">CROSS BELOW / UNDER</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Value</label>
                      <input 
                        type="number"
                        step={alertForm.type === 'PRICE' ? '0.01' : '1'}
                        value={alertForm.value}
                        onChange={(e) => setAlertForm({...alertForm, value: parseFloat(e.target.value)})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 text-[10px] font-black outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      const newAlert: SystemAlert = {
                        id: Date.now().toString(),
                        ...alertForm,
                        isActive: true,
                        delivery: { inApp: true, email: false, push: false }
                      };
                      setAlerts(prev => [...prev, newAlert]);
                      speak(`Alert set for ${newAlert.symbol} ${newAlert.type.toLowerCase()} ${newAlert.condition.toLowerCase()} ${newAlert.value}.`);
                    }}
                    className={cn("w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all", getThemeClass('bg'), "text-black hover:opacity-90 active:scale-95 flex items-center justify-center gap-2 shadow-xl")}
                  >
                    <Plus size={14} /> Add System Trigger
                  </button>
                </div>
              </NeonCard>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Active Monitors</h3>
                {alerts.length === 0 ? (
                  <div className="p-8 border border-zinc-800 border-dashed rounded-[2rem] text-center text-zinc-600 text-[10px] font-black uppercase tracking-widest">
                    No active monitors established
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alerts.map(alert => (
                      <div key={alert.id} className="p-4 rounded-3xl bg-zinc-950/50 border border-zinc-800 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className={cn("w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center", alert.isActive ? getThemeClass('text') : "text-zinc-700")}>
                            {alert.type === 'PRICE' ? <Zap size={18} /> : alert.type === 'RSI' ? <Activity size={18} /> : <Target size={18} />}
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-widest">{alert.symbol} • {alert.type}</div>
                            <div className="text-[8px] text-zinc-500 font-bold uppercase tracking-tighter">
                              Trigger if value is <span className={alert.isActive ? "text-zinc-200" : ""}>{alert.condition} {alert.value}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => setAlerts(prev => prev.map(a => a.id === alert.id ? {...a, isActive: !a.isActive} : a))}
                            className={cn("w-10 h-6 rounded-full transition-colors relative", alert.isActive ? getThemeClass('bg') : "bg-zinc-800")}
                          >
                            <motion.div 
                              animate={{ x: alert.isActive ? 18 : 4 }} 
                              className="absolute top-1 w-4 h-4 rounded-full bg-white" 
                            />
                          </button>
                          <button 
                            onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}
                            className="w-8 h-8 rounded-xl border border-zinc-800 text-zinc-600 hover:text-rose-500 hover:border-rose-500/30 transition-all flex items-center justify-center"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <NeonCard title="Delivery Preferences" theme={theme}>
                <div className="space-y-4 opacity-50">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest">Push Notifications</span>
                    <span className="text-[8px] font-black text-zinc-600 italic">CONFIGURE VIA SETTINGS</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest">Email Delivery</span>
                    <span className="text-[8px] font-black text-zinc-600 italic">ENTERPRISE ONLY</span>
                  </div>
                </div>
              </NeonCard>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <h2 className={cn("text-[10px] font-black uppercase tracking-[0.4em] ml-1 opacity-60", getThemeClass('text'))}>Configuration</h2>
              
              <NeonCard title="Theme Engine" theme={theme}>
                <div className="space-y-4">
                  <div className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1">Select Interface Color</div>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(THEMES).map(([id, t]) => (
                      <button 
                        key={id}
                        onClick={() => setTheme(id)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                          theme === id ? cn(getThemeClass('border', id), "bg-white/5 shadow-sm") : "border-zinc-800"
                        )}
                      >
                        <div className={cn("w-6 h-6 rounded-full border border-black/20", t.bg)} />
                        <span className="text-[8px] font-black uppercase tracking-tighter">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </NeonCard>

              <NeonCard title="Avatar Configuration" theme={theme}>
                <div className="space-y-4">
                  <div className="flex gap-4 items-center">
                    <div className="w-16 h-16 rounded-2xl border-2 border-amber-500/30 overflow-hidden bg-zinc-950">
                      <img src={botImageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <button 
                      onClick={() => avatarInputRef.current?.click()}
                      className="flex-1 py-3 bg-amber-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform"
                    >
                      Upload Avatar
                    </button>
                  </div>

                  <div className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mt-4">Presets</div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { name: "Cyber", url: "https://images.unsplash.com/photo-1546776310-eef45dd6d63c?q=80&w=300&auto=format&fit=crop" },
                      { name: "Stealth", url: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=300&auto=format&fit=crop" },
                      { name: "Core", url: "https://images.unsplash.com/photo-1589254065878-42c9da997008?q=80&w=300&auto=format&fit=crop" },
                      { name: "Mech", url: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=300&auto=format&fit=crop" }
                    ].map((preset) => (
                      <button 
                        key={preset.name}
                        onClick={() => setBotImageUrl(preset.url)}
                        className={cn(
                          "aspect-square rounded-lg overflow-hidden border-2 transition-all",
                          botImageUrl === preset.url ? "border-amber-500 scale-105" : "border-zinc-800 opacity-50"
                        )}
                      >
                        <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                  
                  <div className="pt-2">
                    <div className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-2">Or Custom URL</div>
                    <input 
                      type="text" 
                      value={botImageUrl}
                      onChange={(e) => setBotImageUrl(e.target.value)}
                      placeholder="Paste image link here..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-[10px] font-mono text-amber-500 focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>
              </NeonCard>

              <NeonCard title="App Background">
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => bgInputRef.current?.click()}
                      className="flex-1 py-3 border border-amber-500/30 text-amber-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/5 transition-colors"
                    >
                      Upload Video/Image
                    </button>
                    {backgroundUrl && (
                      <button 
                        onClick={() => setBackgroundUrl('')}
                        className="px-4 border border-rose-500/30 text-rose-500 rounded-xl hover:bg-rose-500/5"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  
                  <div className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">Presets</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { name: "Neon Matrix", url: "https://assets.mixkit.co/videos/preview/mixkit-matrix-style-green-code-lines-background-9051-large.mp4", type: "video" },
                      { name: "Cyber City", url: "https://images.unsplash.com/photo-1545156521-77bd85671d30?q=80&w=600&auto=format&fit=crop", type: "image" }
                    ].map(preset => (
                      <button 
                        key={preset.name}
                        onClick={() => { setBackgroundUrl(preset.url); setBackgroundType(preset.type as any); }}
                        className={cn(
                          "py-2 px-3 rounded-lg border text-[10px] uppercase font-bold transition-all",
                          backgroundUrl === preset.url ? "border-amber-500 text-amber-500 bg-amber-500/10" : "border-zinc-800 text-zinc-500"
                        )}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </NeonCard>

              <NeonCard title="AI Preferences" theme={theme}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest">AI Female Voice</span>
                    <button 
                      onClick={() => { setIsVoiceEnabled(!isVoiceEnabled); speak(isVoiceEnabled ? "" : "Voice assistant active."); }}
                      className={cn("w-12 h-6 rounded-full transition-colors relative", isVoiceEnabled ? getThemeClass('bg') : "bg-zinc-800")}
                    >
                      <motion.div animate={{ x: isVoiceEnabled ? 24 : 4 }} className="absolute top-1 w-4 h-4 rounded-full bg-white" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest">Signal Audio Alerts</span>
                    <button 
                      onClick={() => setIsSignalAudioEnabled(!isSignalAudioEnabled)}
                      className={cn("w-12 h-6 rounded-full transition-colors relative", isSignalAudioEnabled ? getThemeClass('bg') : "bg-zinc-800")}
                    >
                      <motion.div animate={{ x: isSignalAudioEnabled ? 24 : 4 }} className="absolute top-1 w-4 h-4 rounded-full bg-white" />
                    </button>
                  </div>
                </div>
              </NeonCard>

              {showInstallBtn && (
                <button 
                  onClick={handleInstallClick}
                  className={cn(
                    "w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] transition-all bg-white text-black hover:bg-zinc-200 shadow-xl border border-white/20 mb-6 flex items-center justify-center gap-3"
                  )}
                >
                  <Download size={16} />
                  Install Sniper Pro App
                </button>
              )}

              <NeonCard title="Ambient Soundscapes" theme={theme}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest">Background Audio</span>
                    <button 
                      onClick={() => setIsAmbientPlaying(!isAmbientPlaying)}
                      disabled={!ambientSound}
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors relative", 
                        isAmbientPlaying ? getThemeClass('bg') : "bg-zinc-800",
                        !ambientSound && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <motion.div animate={{ x: isAmbientPlaying ? 24 : 4 }} className="absolute top-1 w-4 h-4 rounded-full bg-white" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1">
                      <span>Volume</span>
                      <span className={getThemeClass('text')}>{Math.round(ambientVolume * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.01" 
                      value={ambientVolume} 
                      onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                      className={cn("w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer", getThemeClass('bg').replace('bg-', 'accent-'))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {AMBIENT_SOUNDS.map((sound) => (
                      <button 
                        key={sound.name}
                        onClick={() => {
                          if (ambientSound === sound.url) {
                            setIsAmbientPlaying(!isAmbientPlaying);
                          } else {
                            setAmbientSound(sound.url);
                            setIsAmbientPlaying(true);
                          }
                        }}
                        className={cn(
                          "py-3 px-2 rounded-xl border text-[10px] font-black uppercase tracking-tighter transition-all",
                          ambientSound === sound.url ? cn(getThemeClass('border'), getThemeClass('text'), "bg-white/5") : "border-zinc-800 text-zinc-600 hover:border-zinc-700"
                        )}
                      >
                        {sound.name}
                      </button>
                    ))}
                  </div>
                </div>
              </NeonCard>

              <NeonCard title="Risk Management">
                <div className="space-y-4">
                   <div className="space-y-2">
                     <div className="flex justify-between text-[10px] font-black uppercase">
                       <span>Risk Per Trade</span>
                       <span className="text-amber-500">{riskPerTrade}%</span>
                     </div>
                     <input 
                      type="range" min="0.1" max="5" step="0.1" 
                      value={riskPerTrade} 
                      onChange={(e) => setRiskPerTrade(parseFloat(e.target.value))}
                      className="w-full accent-amber-500 "
                     />
                   </div>
                   <div className="flex items-center justify-between pt-2">
                    <span className="text-xs font-bold uppercase tracking-widest">Auto TP Execution</span>
                    <button className="w-12 h-6 rounded-full bg-amber-500/50 relative px-1 cursor-default"><div className="w-4 h-4 rounded-full bg-white" /></button>
                  </div>
                </div>
              </NeonCard>

              <NeonCard title="System">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest">Broker Mode</span>
                    <span className="text-[10px] font-black text-amber-500 border border-amber-500/30 px-2 py-1 rounded">MULTI-BROKER</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest">App Version</span>
                    <span className="text-[10px] font-black text-zinc-500">3.0.4-OPTIMIZED</span>
                  </div>
                </div>
              </NeonCard>

              <button 
                onClick={() => { localStorage.clear(); window.location.reload(); }}
                className="w-full py-4 rounded-2xl border border-rose-500/30 text-rose-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/5"
              >
                Reset Data Cache
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-[#050505]/80 backdrop-blur-md border-t border-zinc-900/50 p-4 flex items-center justify-around z-20">
        <button onClick={() => setActiveTab('home')} className={cn("flex flex-col items-center gap-1", activeTab === 'home' ? getThemeClass('text') : "text-zinc-600")}>
          <Target size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">Home</span>
        </button>
        <button onClick={() => setActiveTab('symbols')} className={cn("flex flex-col items-center gap-1", activeTab === 'symbols' ? getThemeClass('text') : "text-zinc-600")}>
          <Layers size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">Pairs</span>
        </button>
        <button onClick={() => setActiveTab('scanner')} className={cn("flex flex-col items-center gap-1", activeTab === 'scanner' ? getThemeClass('text') : "text-zinc-600")}>
          <Activity size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">Scanner</span>
        </button>
        <button onClick={() => setActiveTab('logs')} className={cn("flex flex-col items-center gap-1", (activeTab === 'logs' || activeTab === 'history') ? getThemeClass('text') : "text-zinc-600")}>
          <FileText size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">Logs</span>
        </button>
        <button onClick={() => setActiveTab('alerts')} className={cn("flex flex-col items-center gap-1", activeTab === 'alerts' ? getThemeClass('text') : "text-zinc-600")}>
          <Bell size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">Alerts</span>
        </button>
        <button onClick={() => setActiveTab('settings')} className={cn("flex flex-col items-center gap-1", activeTab === 'settings' ? getThemeClass('text') : "text-zinc-600")}>
          <Settings size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">Config</span>
        </button>
      </nav>
    </div>
  );
}
