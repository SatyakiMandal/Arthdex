"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  MicOff,
  Volume2,
  X,
  Globe,
  CheckCircle2,
  CornerDownLeft,
  GripHorizontal,
  Minus,
  Maximize2,
  Minimize2,
  Sparkles,
  Zap,
  Radio,
  ChevronUp,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/context";
import { LOCALES_META } from "@/lib/i18n/locales";
import { SupportedLocale } from "@/lib/i18n/types";
import { parseTerminalCommand } from "@/lib/terminal/functions";
import { cn } from "@/lib/utils";

interface VoiceBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultLocale?: SupportedLocale;
  onExecute?: (cmd: string) => void;
}

interface QuickIntentChip {
  phrase: string;
  command: string;
  label: string;
}

const QUICK_INTENT_CHIPS: Record<SupportedLocale, QuickIntentChip[]> = {
  en: [
    { phrase: "Show reliance supply chain network", command: "RELIANCE SPLC", label: "Reliance Supply Chain" },
    { phrase: "Tata Motors reverse DCF valuation", command: "TATAMOTORS FA", label: "Tata Motors DCF Model" },
    { phrase: "Nifty 50 derivatives options chain", command: "NIFTY OMON", label: "Nifty F&O Chain" },
    { phrase: "Show sovereign yield curve", command: "GC IN", label: "India Sovereign Curve" },
  ],
  hi: [
    { phrase: "रिलायंस का ऑर्डर फ्लो दिखाओ", command: "RELIANCE GP", label: "रिलायंस ऑर्डर फ्लो" },
    { phrase: "टाटा मोटर्स का वैल्यूएशन और बैलेंस शीट", command: "TATAMOTORS FA", label: "टाटा मोटर्स वित्तीय विश्लेषण" },
    { phrase: "निफ्टी ऑप्शंस चेन और ओपन इंटरेस्ट", command: "NIFTY OMON", label: "निफ्टी ५० डेरिवेटिव्स" },
    { phrase: "रिलायंस का सप्लाई चेन नेटवर्क", command: "RELIANCE SPLC", label: "सप्लाई चेन नेटवर्क" },
  ],
  bn: [
    { phrase: "নিফটি ৫০ ডেরিভেটিভস ও অপশন চেন", command: "NIFTY OMON", label: "নিফটি ৫০ ডেরিভেটিভস" },
    { phrase: "রিলায়েন্স সাপ্লাই চেইন নেটওয়ার্ক", command: "RELIANCE SPLC", label: "রিলায়েন্স সাপ্লাই চেইন" },
    { phrase: "টাটা মোটরস ব্যালেন্স শিট ও আর্থিক বিশ্লেষণ", command: "TATAMOTORS FA", label: "টাটা মোটরস ব্যালেন্স শিট" },
    { phrase: "রিলায়েন্সের লাইভ গ্রাফ ও চার্ট", command: "RELIANCE GP", label: "রিলায়েন্স চার্ট" },
  ],
  gu: [
    { phrase: "ટાટા મોટર્સ ડીસીએફ મોડેલ અને બેલેન્સ શીટ", command: "TATAMOTORS FA", label: "ટાટા મોટર્સ ડીસીએફ મોડેલ" },
    { phrase: "રિલાયન્સ ઓર્ડર ફ્લો અને ચાર્ટ", command: "RELIANCE GP", label: "રિલાયન્સ ઓર્ડર ફ્લો" },
    { phrase: "નિફ્ટી ઓપ્શન્સ અને ઓપન ઇન્ટરેસ્ટ", command: "NIFTY OMON", label: "નિફ્ટી ઓપ્શન્સ ચેન" },
    { phrase: "રિલાયન્સ સપ્લાય ચેઇન નેટવર્ક", command: "RELIANCE SPLC", label: "સપ્લાય ચેઇન" },
  ],
  mr: [
    { phrase: "रिलायन्स इंडस्ट्रीज सप्लाय चेन नेटवर्क", command: "RELIANCE SPLC", label: "रिलायन्स सप्लाय चेन" },
    { phrase: "टाटा मोटर्स ताळेबंद आणि मूल्यांकन", command: "TATAMOTORS FA", label: "टाटा मोटर्स ताळेबंद" },
    { phrase: "निफ्टी ५० ऑप्शन्स आणि ओपन इंटरेस्ट", command: "NIFTY OMON", label: "निफ्टी ५० ऑप्शन्स" },
    { phrase: "रिलायन्स ऑर्डर फ्लो आणि चार्ट", command: "RELIANCE GP", label: "रिलायन्स चार्ट" },
  ],
  ta: [
    { phrase: "ரிலையன்ஸ் நிதி பகுப்பாய்வு மற்றும் இருப்புநிலை", command: "RELIANCE FA", label: "ரிலையன்ஸ் நிதி பகுப்பாய்வு" },
    { phrase: "டாடா மோட்டார்ஸ் விநியோக நெட்வொர்க்", command: "TATAMOTORS SPLC", label: "டாடா மோட்டார்ஸ் விநியோகம்" },
    { phrase: "நிஃப்டி 50 விருப்பங்கள் சங்கிலி", command: "NIFTY OMON", label: "நிஃப்டி விருப்பங்கள்" },
    { phrase: "ரிலையன்ஸ் ஆர்டர் ஓட்டம் மற்றும் விளக்கப்படம்", command: "RELIANCE GP", label: "ரிலையன்ஸ் வரைபடம்" },
  ],
  te: [
    { phrase: "రిలయన్స్ ఆర్డర్ ఫ్లో మరియు చార్ట్", command: "RELIANCE GP", label: "రిలయన్స్ ఆర్డర్ ఫ్లో" },
    { phrase: "టాటా మోటార్స్ ఆర్థిక నివేదికలు మరియు డిసిఎఫ్", command: "TATAMOTORS FA", label: "టాటా మోటార్స్ డిసిఎఫ్" },
    { phrase: "నిఫ్టీ 50 డెరివేటివ్స్ మరియు ఓపెన్ ఇంట్రెస్ట్", command: "NIFTY OMON", label: "నిఫ్టీ డెరివేటివ్స్" },
    { phrase: "రిలయన్స్ సరఫరా గొలుసు నెట్‌వర్క్", command: "RELIANCE SPLC", label: "సరఫరా నెట్‌వర్క్" },
  ],
  kn: [
    { phrase: "ರಿಲಯನ್ಸ್ ಸಪ್ಲೈ ಚೈನ್ ನೆಟ್‌ವರ್ಕ್", command: "RELIANCE SPLC", label: "ರಿಲಯನ್ಸ್ ಸಪ್ಲೈ ಚೈನ್" },
    { phrase: "ಟಾಟಾ ಮೋಟಾರ್ಸ್ ಆರ್ಥಿಕ ವರದಿ ಮತ್ತು ಬ್ಯಾಲೆನ್ಸ್ ಶೀಟ್", command: "TATAMOTORS FA", label: "ಟಾಟಾ ಮೋಟಾರ್ಸ್ ವರದಿ" },
    { phrase: "ನಿಫ್ಟಿ 50 ಆಯ್ಕೆಗಳ ಸರಪಳಿ", command: "NIFTY OMON", label: "ನಿಫ್ಟಿ ಆಯ್ಕೆಗಳು" },
  ],
  ml: [
    { phrase: "റിലയൻസ് സപ്ലൈ ചെയിൻ നെറ്റ്‌വർക്ക്", command: "RELIANCE SPLC", label: "റിലയൻസ് സപ്ലൈ ചെയിൻ" },
    { phrase: "ടാറ്റ മോട്ടോഴ്‌സ് ബാലൻസ് ഷീറ്റ് വിശകലനം", command: "TATAMOTORS FA", label: "ടാറ്റ മോട്ടോഴ്‌സ് വിശകലനം" },
    { phrase: "നിഫ്റ്റി 50 ഓപ്ഷൻസ് ചെയിൻ", command: "NIFTY OMON", label: "നിഫ്റ്റി ഓപ്ഷൻസ്" },
  ],
  pa: [
    { phrase: "ਰਿਲਾਇੰਸ ਸਪਲਾਈ ਚੇਨ ਅਤੇ ਆਰਡਰ ਫਲੋ", command: "RELIANCE SPLC", label: "ਰਿਲਾਇੰਸ ਸਪਲਾਈ ਚੇਨ" },
    { phrase: "ਟਾਟਾ ਮੋਟਰਜ਼ ਬੈਲੇਂਸ ਸ਼ੀਟ ਅਤੇ ਵਿੱਤੀ ਵਿਸ਼ਲੇਸ਼ਣ", command: "TATAMOTORS FA", label: "ਟਾਟਾ ਮੋਟਰਜ਼ ਵਿੱਤੀ" },
    { phrase: "ਨਿਫਟੀ 50 ਡੈਰੀਵੇਟਿਵਜ਼ ਅਤੇ ਓਪਨ ਇੰਟਰਸਟ", command: "NIFTY OMON", label: "ਨਿਫਟੀ ਡੈਰੀਵੇਟਿਵਜ਼" },
  ],
  or: [
    { phrase: "ରିଲାଏନ୍ସ ସପ୍ଲାଏ ଚେନ୍ ଏବଂ ନେଟୱାର୍କ", command: "RELIANCE SPLC", label: "ରିଲାଏନ୍ସ ସପ୍ଲାଏ ଚେନ୍" },
    { phrase: "ଟାଟା ମୋଟର୍ସ ଆର୍ଥିକ ବିବରଣୀ ଏବଂ ବାଲାନ୍ସ ସିଟ୍", command: "TATAMOTORS FA", label: "ଟାଟା ମୋଟର୍ସ ଆର୍ଥିକ" },
    { phrase: "ନିଫ୍ଟି 50 ଡେରିଭେଟିଭ୍ସ ଏବଂ ଅପ୍ସନ୍ସ", command: "NIFTY OMON", label: "ନିଫ୍ଟି ଅପ୍ସନ୍ସ" },
  ],
  as: [
    { phrase: "ৰিলায়েন্স যোগান শৃংখল আৰু নেটৱৰ্ক", command: "RELIANCE SPLC", label: "ৰিলায়েন্স যোগান শৃংখল" },
    { phrase: "টাটা মটৰ্ছ বিত্তীয় বিশ্লেষণ আৰু বেলেঞ্চ শ্বীট", command: "TATAMOTORS FA", label: "টাটা মটৰ্ছ বিত্তীয়" },
    { phrase: "নিফটি ৫০ অপচন শৃংখল আৰু ডেৰিভেটিভচ", command: "NIFTY OMON", label: "নিফটি অপচন" },
  ],
  raj: [
    { phrase: "रिलायंस रो सप्लाय चेन नेटवर्क दिखाओ", command: "RELIANCE SPLC", label: "रिलायंस सप्लाय चेन" },
    { phrase: "टाटा मोटर्स रो वैल्यूएशन अर बैलेंस शीट", command: "TATAMOTORS FA", label: "टाटा मोटर्स वैल्यूएशन" },
    { phrase: "निफ्टी 50 ऑप्शंस चेन अर ओपन इंटरेस्ट", command: "NIFTY OMON", label: "निफ्टी ऑप्शंस" },
  ],
  ks: [
    { phrase: "रिलायंस इंडस्ट्रीजुक सप्लाय चेन नेटवर्क", command: "RELIANCE SPLC", label: "रिलायंस सप्लाय चेन" },
    { phrase: "टाटा मोटर्सुच बैलेंस शीट तॖ माली हालत", command: "TATAMOTORS FA", label: "टाटा मोटर्स माली हालत" },
    { phrase: "निफ्टी 50 ऑप्शंस चेन तॖ ओपन इंटरेस्ट", command: "NIFTY OMON", label: "निफ्टी ऑप्शंस" },
  ],
};

export function VoiceBoxModal({ isOpen, onClose, defaultLocale, onExecute }: VoiceBoxModalProps) {
  const router = useRouter();
  const { locale: activeGlobalLocale, setLocale: setGlobalLocale } = useLocale();

  // Selected tongue: initialized from global locale or default
  const [selectedLocale, setSelectedLocale] = useState<SupportedLocale>(defaultLocale || activeGlobalLocale || "en");
  const [isListening, setIsListening] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const [transcript, setTranscript] = useState("");
  const [detectedCommand, setDetectedCommand] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Click microphone to start 15s listening session or click a Quick Intent Chip below.");
  const [audioWaves, setAudioWaves] = useState<number[]>([15, 25, 40, 20, 55, 35, 20, 45, 30, 22, 38, 18]);

  // Window Floating / Dragging state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const timeLeftRef = useRef(15);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRequestedRef = useRef(false);

  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Keep selected locale synchronized with global locale unless defaultLocale was provided
  useEffect(() => {
    if (activeGlobalLocale && !defaultLocale) {
      queueMicrotask(() => {
        setSelectedLocale(activeGlobalLocale);
      });
    }
  }, [activeGlobalLocale, defaultLocale]);

  // Position initialization (floating window at bottom-right)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (position === null) {
      const defaultWidth = 490;
      const defaultHeight = 560;
      const initialX = Math.max(16, window.innerWidth - defaultWidth - 28);
      const initialY = Math.max(64, window.innerHeight - defaultHeight - 28);
      queueMicrotask(() => {
        setPosition({ x: initialX, y: initialY });
      });
    }
  }, [position]);

  // Handle Dragging
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newX = e.clientX - dragOffsetRef.current.x;
      const newY = e.clientY - dragOffsetRef.current.y;
      const maxX = Math.max(0, window.innerWidth - 180);
      const maxY = Math.max(0, window.innerHeight - 50);
      setPosition({
        x: Math.max(0, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY)),
      });
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const handleTitleBarMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) return;

    isDraggingRef.current = true;
    const currentX = position?.x ?? Math.max(16, window.innerWidth - 500);
    const currentY = position?.y ?? Math.max(64, window.innerHeight - 580);
    dragOffsetRef.current = {
      x: e.clientX - currentX,
      y: e.clientY - currentY,
    };
    e.preventDefault();
  };

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  // Clean stop of recognition & timer
  const stopListening = (requestedByUser = true, customStatus?: string) => {
    stopRequestedRef.current = requestedByUser;
    isListeningRef.current = false;
    setIsListening(false);
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    if (customStatus) {
      setStatusMessage(customStatus);
    } else if (requestedByUser) {
      setStatusMessage("Listening paused. Review transcript or click RUN.");
    }
  };

  // Start listening with 15-second countdown
  const startListening = () => {
    stopRequestedRef.current = false;
    isListeningRef.current = true;
    setIsListening(true);
    setTranscript("");
    setDetectedCommand(null);
    setTimeLeft(15);
    timeLeftRef.current = 15;
    setStatusMessage(`Listening for ${LOCALES_META[selectedLocale]?.name || "Hindi"} commands (15s remaining)...`);

    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      timeLeftRef.current -= 1;
      setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) {
        stopListening(false, "15-second window completed. Review detected intent.");
      }
    }, 1000);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.lang = LOCALES_META[selectedLocale]?.bcp47 || "en-IN";
        recognitionRef.current.start();
      } catch {
        // If transitioning or already started
        try {
          recognitionRef.current.stop();
        } catch {}
        setTimeout(() => {
          if (isListeningRef.current && !stopRequestedRef.current) {
            try {
              recognitionRef.current?.start();
            } catch {}
          }
        }, 120);
      }
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening(true);
    } else {
      startListening();
    }
  };

  // Initialize Speech Recognition with continuous=true and auto-restart guard
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = LOCALES_META[selectedLocale]?.bcp47 || "en-IN";

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
        setStatusMessage(`Listening active (${LOCALES_META[selectedLocale]?.name})... Speak command`);
      };

      recognition.onresult = (event: any) => {
        let combined = "";
        for (let i = 0; i < event.results.length; i++) {
          combined += event.results[i][0].transcript + " ";
        }
        const text = combined.trim();
        if (text) {
          setTranscript(text);
          const resolved = parseVoiceIntent(text, selectedLocale);
          if (resolved) {
            setDetectedCommand(resolved);
            setStatusMessage(`Synthesized: ${resolved} <GO>`);
          }
        }
      };

      recognition.onerror = (event: any) => {
        // 'no-speech' is a transient silence notification; do not cancel session
        if (event.error === "no-speech") {
          return;
        }
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          stopListening(true, "Microphone permission blocked. Click any 1-Click Quick Intent Chip below!");
          return;
        }
        // Auto-restart for transient engine glitches if time remains
        if (isListeningRef.current && !stopRequestedRef.current && timeLeftRef.current > 0) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.onend = () => {
        // If listening is still marked true and timeout hasn't elapsed, auto-restart immediately
        if (isListeningRef.current && !stopRequestedRef.current && timeLeftRef.current > 0) {
          try {
            recognition.start();
          } catch {
            setTimeout(() => {
              if (isListeningRef.current && !stopRequestedRef.current && timeLeftRef.current > 0) {
                try {
                  recognition.start();
                } catch {}
              }
            }, 100);
          }
        } else {
          setIsListening(false);
          isListeningRef.current = false;
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
        }
      };

      recognitionRef.current = recognition;
    } else {
      queueMicrotask(() => {
        setStatusMessage("Web Speech API not supported on this browser. Click any Quick Intent Chip below!");
      });
    }

    return () => {
      isListeningRef.current = false;
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      recognitionRef.current?.abort();
    };
  }, [selectedLocale]);

  // Waveform oscillation when listening
  useEffect(() => {
    if (!isListening) return;
    const interval = setInterval(() => {
      setAudioWaves([
        Math.floor(Math.random() * 45) + 15,
        Math.floor(Math.random() * 60) + 20,
        Math.floor(Math.random() * 80) + 15,
        Math.floor(Math.random() * 65) + 25,
        Math.floor(Math.random() * 95) + 15,
        Math.floor(Math.random() * 70) + 20,
        Math.floor(Math.random() * 85) + 15,
        Math.floor(Math.random() * 55) + 20,
        Math.floor(Math.random() * 75) + 15,
        Math.floor(Math.random() * 50) + 20,
        Math.floor(Math.random() * 65) + 15,
        Math.floor(Math.random() * 35) + 15,
      ]);
    }, 100);
    return () => clearInterval(interval);
  }, [isListening]);

  // Execute synthesized command
  const executeCommand = (cmdText?: string) => {
    const target = cmdText || detectedCommand;
    if (!target) return;
    if (onExecute) {
      onExecute(target);
      onClose();
      return;
    }
    const cmd = parseTerminalCommand(target);
    if (cmd.targetUrl) {
      onClose();
      router.push(cmd.targetUrl);
    }
  };

  // 1-Click Quick Intent Chip handler
  const handleSelectQuickChip = (chip: QuickIntentChip, autoRun = true) => {
    if (isListening) {
      stopListening(true);
    }
    setTranscript(chip.phrase);
    setDetectedCommand(chip.command);
    setStatusMessage(`Intent loaded: ${chip.command} <GO>`);
    if (autoRun) {
      setTimeout(() => {
        executeCommand(chip.command);
      }, 220);
    }
  };

  // Text to Speech playback
  const speakResponse = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LOCALES_META[selectedLocale]?.bcp47 || "en-IN";
    utterance.rate = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  if (!isOpen) return null;

  const quickChips = QUICK_INTENT_CHIPS[selectedLocale] || QUICK_INTENT_CHIPS.en;

  // Render floating non-modal desktop window
  return (
    <div
      role="dialog"
      aria-label="Regional Voice Terminal Window"
      className={cn(
        "fixed z-50 select-none bg-surface border border-border shadow-2xl flex flex-col font-mono text-2xs overflow-hidden transition-[width,height] duration-150",
        isMaximized && "!top-4 !left-4 !right-4 !bottom-4 !w-auto !h-auto max-w-none max-h-none border-accent ring-1 ring-accent/30",
      )}
      style={
        isMaximized
          ? { top: 16, left: 16, right: 16, bottom: 16 }
          : position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              width: isMinimized ? "360px" : "490px",
              maxWidth: "calc(100vw - 24px)",
              maxHeight: isMinimized ? "42px" : "calc(100vh - 48px)",
            }
          : {
              right: "24px",
              bottom: "24px",
              width: "490px",
              maxWidth: "calc(100vw - 24px)",
            }
      }
    >
      {/* Draggable Title Bar */}
      <div
        onMouseDown={handleTitleBarMouseDown}
        className={cn(
          "flex items-center justify-between px-3 py-2 border-b border-border bg-surface-muted/80 cursor-grab active:cursor-grabbing select-none",
          isListening && "border-b-accent/50 bg-accent/10",
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal className="h-4 w-4 text-muted-foreground/60 shrink-0" aria-hidden />
          <div className="flex items-center gap-1.5 truncate">
            {isListening ? (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
              </span>
            ) : (
              <Radio className="h-3.5 w-3.5 text-accent shrink-0" />
            )}
            <span className="font-bold text-xs uppercase text-foreground tracking-wider truncate">
              VOICE TERMINAL (M30)
            </span>
            <span className="px-1 py-0 text-3xs font-bold uppercase bg-accent/20 text-accent border border-accent/40 shrink-0">
              {selectedLocale.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {isListening && (
            <span className="hidden sm:inline-flex items-center px-1.5 py-0 text-3xs font-mono font-bold bg-destructive text-destructive-foreground animate-pulse mr-1">
              REC {timeLeft}s
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsMinimized((v) => !v)}
            title={isMinimized ? "Restore Voice Box" : "Minimize to floating dock"}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
          >
            {isMinimized ? <ChevronUp className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsMaximized((v) => !v);
              if (isMinimized) setIsMinimized(false);
            }}
            title={isMaximized ? "Restore window size" : "Maximize window"}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
          >
            {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close Voice Terminal (Esc)"
            className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Body (hidden when minimized) */}
      {!isMinimized && (
        <div className="flex flex-col flex-1 overflow-y-auto max-h-[calc(100vh-100px)]">
          {/* 14 Regional Language Selection Grid */}
          <div className="p-2.5 border-b border-border/80 bg-surface">
            <div className="flex items-center justify-between mb-1.5 text-3xs text-muted-foreground">
              <span className="flex items-center gap-1 font-bold uppercase">
                <Globe className="h-3 w-3 text-accent" />
                <span>ACTIVE REGIONAL TONGUE:</span>
              </span>
              <span className="text-foreground font-bold font-sans">
                {LOCALES_META[selectedLocale].nativeName} ({LOCALES_META[selectedLocale].name}) · {LOCALES_META[selectedLocale].lakhScale}/{LOCALES_META[selectedLocale].croreScale}
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 text-3xs">
              {(Object.keys(LOCALES_META) as SupportedLocale[]).map((loc) => {
                const itemMeta = LOCALES_META[loc];
                const isSel = selectedLocale === loc;
                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => {
                      setSelectedLocale(loc);
                      setGlobalLocale(loc);
                      if (isListening) {
                        stopListening(false, `Switched language to ${itemMeta.name}`);
                      }
                    }}
                    className={cn(
                      "p-1 text-center border truncate transition-all",
                      isSel
                        ? "bg-accent text-accent-foreground border-accent font-bold shadow-sm ring-1 ring-accent"
                        : "bg-surface-muted/50 text-muted-foreground border-border/60 hover:text-foreground hover:border-foreground/60 hover:bg-surface-muted",
                    )}
                    title={`${itemMeta.name} (${itemMeta.nativeName})`}
                  >
                    <div className="truncate font-sans font-semibold text-2xs">{itemMeta.nativeName}</div>
                    <div className="text-[7.5px] opacity-80 uppercase font-mono">{itemMeta.code.toUpperCase()}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Listening State & Visual Audio-Wave Meter */}
          <div className="p-4 flex flex-col items-center justify-center bg-surface-muted/20 border-b border-border">
            {/* Live Audio Wave Meter */}
            <div className="h-12 flex items-center justify-center gap-1 mb-3 w-full max-w-xs">
              {audioWaves.map((height, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "w-1.5 transition-all duration-100 rounded-none",
                    isListening ? "bg-accent shadow-[0_0_8px_rgba(235,160,0,0.5)]" : "bg-muted-foreground/30",
                  )}
                  style={{ height: `${isListening ? height : 6}px` }}
                />
              ))}
            </div>

            {/* Big Action Microphone Button & Countdown */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={toggleListening}
                className={cn(
                  "h-14 w-14 rounded-full flex items-center justify-center border-2 transition-all shadow-lg active:scale-95",
                  isListening
                    ? "bg-destructive text-destructive-foreground border-destructive animate-pulse ring-4 ring-destructive/20"
                    : "bg-accent text-accent-foreground border-accent hover:brightness-110 ring-2 ring-accent/30",
                )}
                title={isListening ? "Pause Listening" : "Start 15-second Speech Session"}
              >
                {isListening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </button>

              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-3xs font-mono font-bold uppercase tracking-wider border rounded-none",
                      isListening
                        ? "bg-destructive/15 text-destructive border-destructive/40"
                        : "bg-surface-muted text-muted-foreground border-border",
                    )}
                  >
                    {isListening ? `⏱️ LISTENING: ${timeLeft}s REMAINING` : "⏱️ 15-SECOND SPEECH WINDOW"}
                  </span>
                </div>
                <span className="text-3xs text-muted-foreground mt-1">
                  {isListening ? "Speak company name or Bloomberg mnemonic" : "Click mic to speak in regional tongue"}
                </span>
              </div>
            </div>

            <p className="mt-2.5 text-3xs text-muted-foreground text-center italic max-w-sm">
              {statusMessage}
            </p>
          </div>

          {/* 1-Click Quick Intent Speech Chips */}
          <div className="p-2.5 border-b border-border bg-surface-muted/30">
            <div className="flex items-center justify-between mb-1.5 text-3xs">
              <span className="font-bold text-foreground flex items-center gap-1 uppercase tracking-wider">
                <Zap className="h-3 w-3 text-accent" />
                <span>1-CLICK QUICK INTENTS ({LOCALES_META[selectedLocale].nativeName}):</span>
              </span>
              <span className="text-muted-foreground text-3xs">No mic required</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {quickChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectQuickChip(chip, true)}
                  className="group inline-flex items-center gap-1.5 px-2 py-1 bg-surface border border-border/80 hover:border-accent hover:bg-surface-raised transition-colors text-left"
                >
                  <Sparkles className="h-3 w-3 text-accent shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="font-sans font-medium text-foreground text-xs">{chip.phrase}</span>
                  <span className="px-1 py-0 text-3xs font-mono font-bold bg-accent/15 text-accent border border-accent/30 shrink-0">
                    {chip.command}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Spoken Transcript & Synthesized Command */}
          <div className="p-3 space-y-2.5 bg-surface">
            <div>
              <div className="text-3xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-between">
                <span>SPOKEN TRANSCRIPT:</span>
                {transcript && (
                  <button
                    type="button"
                    onClick={() => {
                      setTranscript("");
                      setDetectedCommand(null);
                    }}
                    className="hover:text-foreground text-3xs font-bold"
                  >
                    CLEAR
                  </button>
                )}
              </div>
              <div className="p-2.5 border border-border bg-surface-muted/40 text-foreground text-xs min-h-[44px] leading-relaxed select-text font-sans">
                {transcript ? (
                  <span className="text-foreground font-medium">{transcript}</span>
                ) : (
                  <span className="text-muted-foreground/60 italic font-mono text-2xs">
                    Speak financial command or click any Quick Intent Chip above...
                  </span>
                )}
              </div>
            </div>

            {detectedCommand && (
              <div className="p-2.5 border border-accent/50 bg-accent/10 flex items-center justify-between animate-in fade-in duration-100">
                <div>
                  <div className="text-3xs text-accent font-bold uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>SYNTHESIZED BLOOMBERG COMMAND:</span>
                  </div>
                  <div className="font-mono font-bold text-sm text-foreground mt-0.5 tracking-wide">
                    {detectedCommand} &lt;GO&gt;
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => executeCommand(detectedCommand)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-accent-foreground font-mono font-bold text-xs uppercase hover:brightness-110 active:scale-95 transition-all shadow-md"
                >
                  <span>RUN</span>
                  <CornerDownLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Institutional Bloomberg Footer */}
          <div className="mt-auto p-2.5 border-t border-border bg-surface-muted/70 flex items-center justify-between text-3xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5 text-accent" />
              <span>DRAG WINDOW ANYWHERE • ESC TO CLOSE</span>
            </div>
            {detectedCommand && (
              <button
                type="button"
                onClick={() => speakResponse(`Executing ${detectedCommand}`)}
                className="hover:text-foreground font-bold uppercase transition-colors"
              >
                [VOICE SYNTHESIS TEST]
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Multilingual Voice Intent Parser for 14 Indian Languages.
 * Maps natural phrases across 14 languages into Bloomberg terminal commands.
 */
function parseVoiceIntent(spoken: string, locale: SupportedLocale): string | null {
  const text = spoken.toLowerCase().trim();
  if (!text) return null;

  // 1. Extract Security Ticker from spoken text
  let symbol = "RELIANCE";
  if (
    text.includes("reliance") ||
    text.includes("रिलायंस") ||
    text.includes("রিলায়েন্স") ||
    text.includes("રિલાયન્સ") ||
    text.includes("ரிலையன்ஸ்") ||
    text.includes("రిలయన్స్") ||
    text.includes("ರಿಲಯನ್ಸ್") ||
    text.includes("റിലയൻസ്") ||
    text.includes("ਰਿਲਾਇੰਸ") ||
    text.includes("ରିଲାଏନ୍ସ") ||
    text.includes("ৰিলায়েন্স")
  ) {
    symbol = "RELIANCE";
  } else if (
    text.includes("tata motors") ||
    text.includes("टाटा मोटर") ||
    text.includes("टाटा") ||
    text.includes("টাটা মোটরস") ||
    text.includes("ટાટા મોટર્સ") ||
    text.includes("டாடா மோட்டார்ஸ்") ||
    text.includes("టాటా మోటార్స్") ||
    text.includes("ಟಾಟಾ ಮೋಟಾರ್ಸ್") ||
    text.includes("ടാറ്റ മോട്ടോഴ്‌സ്") ||
    text.includes("ਟਾਟਾ ਮੋਟਰਜ਼") ||
    text.includes("ଟାଟା ମୋଟର୍ସ") ||
    text.includes("টাটা মটৰ্ছ")
  ) {
    symbol = "TATAMOTORS";
  } else if (
    text.includes("mahindra") ||
    text.includes("महिंद्रा") ||
    text.includes("মহিন্দ্রা") ||
    text.includes("મહિન્દ્રા") ||
    text.includes("மகிந்திரா") ||
    text.includes("మహీంద్రా") ||
    text.includes("m&m")
  ) {
    symbol = "M&M";
  } else if (
    text.includes("infosys") ||
    text.includes("इंफोसिस") ||
    text.includes("ইনফোসিস") ||
    text.includes("ઇન્ફોસિસ") ||
    text.includes("இன்போசிஸ்") ||
    text.includes("ఇన్ఫోసిస్") ||
    text.includes("ಇನ್ಫೋಸಿಸ್") ||
    text.includes("ഇൻഫോസിസ്") ||
    text.includes("infy")
  ) {
    symbol = "INFY";
  } else if (
    text.includes("tcs") ||
    text.includes("टीसीएस") ||
    text.includes("টিসিএস") ||
    text.includes("ટીસીએસ") ||
    text.includes("டிசிஎஸ்") ||
    text.includes("టిసిఎస్")
  ) {
    symbol = "TCS";
  } else if (
    text.includes("hdfc") ||
    text.includes("एचडीएफसी") ||
    text.includes("এইচডিএফসি") ||
    text.includes("એચડીએફસી")
  ) {
    symbol = "HDFCBANK";
  } else if (
    text.includes("state bank") ||
    text.includes("sbi") ||
    text.includes("एसबीआई") ||
    text.includes("এসবিআই") ||
    text.includes("ఎస్బీఐ")
  ) {
    symbol = "SBIN";
  } else if (
    text.includes("nifty") ||
    text.includes("निफ्टी") ||
    text.includes("নিফটি") ||
    text.includes("નિફ્ટી") ||
    text.includes("நிஃப்டி") ||
    text.includes("నిఫ్టీ") ||
    text.includes("ನಿಫ್ಟಿ") ||
    text.includes("നിഫ്റ്റി") ||
    text.includes("ਨਿਫਟੀ") ||
    text.includes("ନିଫ୍ଟି") ||
    text.includes("নিফটি")
  ) {
    symbol = "NIFTY";
  }

  // 2. Intent Mapping to Bloomberg Functions

  // A. Order Flow & Microstructure (FLOW or GP)
  if (
    text.includes("order flow") ||
    text.includes("ऑर्डर फ्लो") ||
    text.includes("অর্ডার ফ্লো") ||
    text.includes("ઓર્ડર ફ્લો") ||
    text.includes("ஆர்டர் ஓட்டம்") ||
    text.includes("ఆర్డర్ ఫ్లో") ||
    text.includes("ಆರ್ಡರ್ ಫ್ಲೋ") ||
    text.includes("ഓർഡർ ഫ്ലോ") ||
    text.includes("ਆਰਡਰ ਫਲੋ")
  ) {
    return `${symbol} GP`;
  }

  // B. Supply Chain & Supplier Network (SPLC)
  if (
    text.includes("supply") ||
    text.includes("supplier") ||
    text.includes("सप्लाई") ||
    text.includes("सप्लायर") ||
    text.includes("सप्लाय") ||
    text.includes("সরবরাহ") ||
    text.includes("સપ્લાય") ||
    text.includes("સપ્લાયર") ||
    text.includes("விநியோக") ||
    text.includes("సరఫరా") ||
    text.includes("ಸಪ್ಲೈ") ||
    text.includes("സപ്ലൈ") ||
    text.includes("ਸ਼ਪਲਾਈ") ||
    text.includes("যোগান") ||
    text.includes("network") ||
    text.includes("नेटवर्क") ||
    text.includes("নেটওয়ার্ক") ||
    text.includes("ਨੇਟਵਰਕ")
  ) {
    return `${symbol} SPLC`;
  }

  // C. Reverse DCF Valuation & Financial Statements (FA)
  if (
    text.includes("valuation") ||
    text.includes("वैल्यूएशन") ||
    text.includes("মূল্যায়ন") ||
    text.includes("મૂલ્યાંકન") ||
    text.includes("மதிப்பீடு") ||
    text.includes("విలువ") ||
    text.includes("ಮೌಲ್ಯಮಾಪನ") ||
    text.includes("മൂല്യനിർണ്ണയം") ||
    text.includes("ਮੁੱਲ") ||
    text.includes("ମୂଲ୍ୟାଙ୍କନ") ||
    text.includes("dcf") ||
    text.includes("डीसीएफ") ||
    text.includes("financial") ||
    text.includes("balance sheet") ||
    text.includes("बैलेंस शीट") ||
    text.includes("वित्तीय") ||
    text.includes("তাळेबंद") ||
    text.includes("ফলাফল") ||
    text.includes("নাણાકીય") ||
    text.includes("இருப்புநிலை") ||
    text.includes("నివేదికలు") ||
    text.includes("ವರದಿ") ||
    text.includes("ബാലൻസ് ഷീറ്റ്") ||
    text.includes("विੱਤੀ") ||
    text.includes("ବିବରଣୀ")
  ) {
    return `${symbol} FA`;
  }

  // D. Options Chain & Derivatives (OMON)
  if (
    text.includes("option") ||
    text.includes("ऑप्शन") ||
    text.includes("অপশন") ||
    text.includes("ઓપ્શન") ||
    text.includes("விருப்பங்கள்") ||
    text.includes("ఆప్షన్") ||
    text.includes("ಆಯ್ಕೆ") ||
    text.includes("ഓപ്ഷൻ") ||
    text.includes("ਆਪਸ਼ਨ") ||
    text.includes("derivative") ||
    text.includes("डेरिवेटिव") ||
    text.includes("ডেরিভেটিভ") ||
    text.includes("ഡെറിവേറ്റീവ്") ||
    text.includes("డెరివేటివ్స్") ||
    text.includes("chain")
  ) {
    return `NIFTY OMON`;
  }

  // E. Chart / Technicals (GP)
  if (
    text.includes("chart") ||
    text.includes("चार्ट") ||
    text.includes("গ্রাফ") ||
    text.includes("ચાર્ટ") ||
    text.includes("வரைபடம்") ||
    text.includes("చార్ట్") ||
    text.includes("ನಕ್ಷೆ") ||
    text.includes("ചാർട്ട്") ||
    text.includes("graph") ||
    text.includes("भाव") ||
    text.includes("price") ||
    text.includes("દર")
  ) {
    return `${symbol} GP`;
  }

  // F. Sovereign Yield Curve (GC IN)
  if (
    text.includes("yield") ||
    text.includes("यील्ड") ||
    text.includes("ইল্ড") ||
    text.includes("યીલ્ડ") ||
    text.includes("ஈவு") ||
    text.includes("bond") ||
    text.includes("gsec") ||
    text.includes("बॉन्ड") ||
    text.includes("curve")
  ) {
    return `GC IN`;
  }

  // G. Surveillance Desk (SURV)
  if (
    text.includes("surveillance") ||
    text.includes("sebi") ||
    text.includes("निगरानी") ||
    text.includes("নজরদারি") ||
    text.includes("સર્વેલન્સ") ||
    text.includes("asm") ||
    text.includes("gsm")
  ) {
    return `SURV`;
  }

  // H. Conglomerate Hierarchy / Holdings (HOLD)
  if (
    text.includes("holding") ||
    text.includes("subsidiary") ||
    text.includes("होल्डिंग") ||
    text.includes("सहযোগী") ||
    text.includes("સબસિડિયરી") ||
    text.includes("துணை நிறுவனம்") ||
    text.includes("group")
  ) {
    return `${symbol} HOLD`;
  }

  // I. Market Watch (MOST)
  if (
    text.includes("market watch") ||
    text.includes("gainers") ||
    text.includes("losers") ||
    text.includes("मार्केट वॉच") ||
    text.includes("गेनर्स") ||
    text.includes("बजार") ||
    text.includes("বাজার")
  ) {
    return `MOST`;
  }

  return `${symbol} DES`;
}
