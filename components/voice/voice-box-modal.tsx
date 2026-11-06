"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Volume2, X, Play, Globe, CheckCircle2, AlertCircle, CornerDownLeft } from "lucide-react";
import { LOCALES_META } from "@/lib/i18n/locales";
import { SupportedLocale } from "@/lib/i18n/types";
import { parseTerminalCommand } from "@/lib/terminal/functions";

interface VoiceBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultLocale?: SupportedLocale;
  onExecute?: (cmd: string) => void;
}

export function VoiceBoxModal({ isOpen, onClose, defaultLocale = "en", onExecute }: VoiceBoxModalProps) {
  const router = useRouter();
  const [selectedLocale, setSelectedLocale] = useState<SupportedLocale>(defaultLocale);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [detectedCommand, setDetectedCommand] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Click microphone to speak financial query...");
  const [audioWaves, setAudioWaves] = useState<number[]>([15, 30, 45, 20, 60, 40, 25, 50, 35]);

  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = LOCALES_META[selectedLocale]?.bcp47 || "en-IN";

      recognition.onstart = () => {
        setIsListening(true);
        setStatusMessage("Listening... Speak company name or market command");
      };

      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const text = event.results[current][0].transcript;
        setTranscript(text);
        const resolved = parseVoiceIntent(text, selectedLocale);
        if (resolved) {
          setDetectedCommand(resolved);
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        setStatusMessage(`Speech detection error: ${event.error || "Please try again"}`);
      };

      recognition.onend = () => {
        setIsListening(false);
        setStatusMessage("Speech processing complete.");
      };

      recognitionRef.current = recognition;
    } else {
      queueMicrotask(() => {
        setStatusMessage("Web Speech API not supported by browser. Type query manually.");
      });
    }

    return () => {
      recognitionRef.current?.abort();
    };
  }, [selectedLocale]);

  // Waveform animation when listening
  useEffect(() => {
    if (!isListening) return;
    const interval = setInterval(() => {
      setAudioWaves([
        Math.floor(Math.random() * 55) + 15,
        Math.floor(Math.random() * 65) + 20,
        Math.floor(Math.random() * 85) + 10,
        Math.floor(Math.random() * 70) + 25,
        Math.floor(Math.random() * 95) + 15,
        Math.floor(Math.random() * 60) + 20,
        Math.floor(Math.random() * 80) + 10,
        Math.floor(Math.random() * 50) + 25,
        Math.floor(Math.random() * 40) + 15,
      ]);
    }, 120);
    return () => clearInterval(interval);
  }, [isListening]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript("");
      setDetectedCommand(null);
      try {
        recognitionRef.current.lang = LOCALES_META[selectedLocale]?.bcp47 || "en-IN";
        recognitionRef.current.start();
      } catch (e) {
        recognitionRef.current.stop();
        setTimeout(() => recognitionRef.current?.start(), 150);
      }
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

  const executeCommand = () => {
    if (!detectedCommand) return;
    if (onExecute) {
      onExecute(detectedCommand);
      onClose();
      return;
    }
    const cmd = parseTerminalCommand(detectedCommand);
    if (cmd.targetUrl) {
      onClose();
      router.push(cmd.targetUrl);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150 font-mono">
      <div className="relative w-full max-w-lg bg-surface border border-border shadow-2xl overflow-hidden flex flex-col text-2xs">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-muted/60">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-accent animate-pulse" />
            <span className="font-bold text-xs uppercase text-foreground tracking-wider">
              14-LANGUAGE REGIONAL VOICE TERMINAL
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Language Selection Grid */}
        <div className="p-2.5 border-b border-border/80 bg-surface">
          <div className="flex items-center justify-between mb-1.5 text-3xs text-muted-foreground">
            <span className="flex items-center gap-1 font-bold uppercase">
              <Globe className="h-3 w-3 text-accent" />
              <span>SELECT REGIONAL TONGUE:</span>
            </span>
            <span className="text-foreground font-bold">
              {LOCALES_META[selectedLocale].name} ({LOCALES_META[selectedLocale].nativeName})
            </span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 text-3xs">
            {(Object.keys(LOCALES_META) as SupportedLocale[]).map((loc) => {
              const meta = LOCALES_META[loc];
              const isSel = selectedLocale === loc;
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => {
                    setSelectedLocale(loc);
                    if (isListening && recognitionRef.current) {
                      recognitionRef.current.stop();
                    }
                  }}
                  className={`p-1 text-center border truncate transition-colors ${
                    isSel
                      ? "bg-accent text-accent-foreground border-accent font-bold shadow-sm"
                      : "bg-surface-muted/40 text-muted-foreground border-border/60 hover:text-foreground hover:border-foreground"
                  }`}
                  title={`${meta.name} (${meta.nativeName})`}
                >
                  <div className="truncate font-bold">{meta.nativeName}</div>
                  <div className="text-[7.5px] opacity-80 uppercase">{meta.code}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Waveform & Listening State */}
        <div className="p-6 flex flex-col items-center justify-center bg-surface-muted/20 border-b border-border">
          {/* Audio Wave Bars */}
          <div className="h-16 flex items-center gap-1.5 mb-4">
            {audioWaves.map((height, idx) => (
              <div
                key={idx}
                className={`w-1.5 transition-all duration-100 ${
                  isListening ? "bg-accent" : "bg-muted-foreground/30"
                }`}
                style={{ height: `${isListening ? height : 8}px` }}
              />
            ))}
          </div>

          {/* Big Microphone Toggle Button */}
          <button
            type="button"
            onClick={toggleListening}
            className={`h-14 w-14 rounded-full flex items-center justify-center border-2 transition-all shadow-md ${
              isListening
                ? "bg-destructive text-destructive-foreground border-destructive animate-pulse"
                : "bg-accent text-accent-foreground border-accent hover:scale-105"
            }`}
            title={isListening ? "Stop Listening" : "Start Listening"}
          >
            {isListening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </button>

          <p className="mt-3 text-3xs text-muted-foreground text-center">{statusMessage}</p>
        </div>

        {/* Live Transcript & Detected Command */}
        <div className="p-3 space-y-2 bg-surface">
          <div>
            <div className="text-3xs uppercase tracking-wider text-muted-foreground mb-0.5">
              SPOKEN TRANSCRIPT:
            </div>
            <div className="p-2 border border-border bg-surface-muted/40 text-foreground text-xs min-h-[40px] leading-relaxed">
              {transcript || <span className="text-muted-foreground italic">Say something like &quot;रिलायंस का चार्ट&quot; or &quot;टाटा मोटर्स सप्लाई चेन&quot;...</span>}
            </div>
          </div>

          {detectedCommand && (
            <div className="p-2 border border-accent/40 bg-accent/10 flex items-center justify-between">
              <div>
                <div className="text-3xs text-accent font-bold uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>SYNTHESIZED BLOOMBERG COMMAND:</span>
                </div>
                <div className="font-mono font-bold text-xs text-foreground mt-0.5">
                  {detectedCommand} &lt;GO&gt;
                </div>
              </div>
              <button
                type="button"
                onClick={executeCommand}
                className="flex items-center gap-1 px-3 py-1.5 bg-accent text-accent-foreground font-bold text-3xs uppercase hover:bg-accent/90 transition-colors"
              >
                <span>RUN</span>
                <CornerDownLeft className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Helper Footer */}
        <div className="p-2.5 border-t border-border bg-surface-muted/60 flex items-center justify-between text-3xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Volume2 className="h-3 w-3 text-accent" />
            <span>PRESS ESC TO CLOSE • ALT+V TO TOGGLE</span>
          </div>
          {detectedCommand && (
            <button
              type="button"
              onClick={() => speakResponse(`Executing ${detectedCommand}`)}
              className="hover:text-foreground font-bold uppercase"
            >
              [TEST AUDIO]
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Multilingual Voice Intent Parser for 14 Indian Languages.
 * Maps natural phrases into Bloomberg command mnemonics.
 */
function parseVoiceIntent(spoken: string, locale: SupportedLocale): string | null {
  const text = spoken.toLowerCase().trim();
  if (!text) return null;

  // Extract Security Ticker from spoken text
  let symbol = "RELIANCE";
  if (text.includes("reliance") || text.includes("रिलायंस") || text.includes("রিলায়েন্স") || text.includes("રિલાયન્સ") || text.includes("ரிலையன்ஸ்")) {
    symbol = "RELIANCE";
  } else if (text.includes("tata motors") || text.includes("टाटा मोटर") || text.includes("টাটা মোটরস") || text.includes("ટાટા મોટર્સ") || text.includes("டாடா மோட்டார்ஸ்")) {
    symbol = "TATAMOTORS";
  } else if (text.includes("mahindra") || text.includes("महिंद्रा") || text.includes("মহিন্দ্রা") || text.includes("મહિન્દ્રા") || text.includes("மகிந்திரா") || text.includes("m&m")) {
    symbol = "M&M";
  } else if (text.includes("infosys") || text.includes("इंफोसिस") || text.includes("ইনফোসিস") || text.includes("ઇન્ફોસિસ") || text.includes("இன்போசிஸ்") || text.includes("infy")) {
    symbol = "INFY";
  } else if (text.includes("tcs") || text.includes("टीसीएस") || text.includes("টিসিএস")) {
    symbol = "TCS";
  } else if (text.includes("hdfc") || text.includes("एचडीएफसी")) {
    symbol = "HDFCBANK";
  } else if (text.includes("state bank") || text.includes("sbi") || text.includes("एसबीआई")) {
    symbol = "SBIN";
  } else if (text.includes("nifty") || text.includes("निफ्टी") || text.includes("নিফটি") || text.includes("நிஃப்டி")) {
    symbol = "NIFTY";
  }

  // Intent Mapping to Bloomberg Function
  // 1. Chart / Technicals (GP)
  if (
    text.includes("chart") ||
    text.includes("चार्ट") ||
    text.includes("গ্রাফ") ||
    text.includes("ચાર્ટ") ||
    text.includes("வரைபடம்") ||
    text.includes("చార్ట్") ||
    text.includes("ನಕ್ಷೆ") ||
    text.includes("graph") ||
    text.includes("ભાવ") ||
    text.includes("price")
  ) {
    return `${symbol} GP`;
  }

  // 2. Supply Chain & Relationships (SPLC)
  if (
    text.includes("supplier") ||
    text.includes("supply") ||
    text.includes("सप्लाई") ||
    text.includes("सप्लायर") ||
    text.includes("সরবরাহ") ||
    text.includes("સપ્લાયર") ||
    text.includes("விநியோக") ||
    text.includes("సప్లై") ||
    text.includes("network") ||
    text.includes("जाळो")
  ) {
    return `${symbol} SPLC`;
  }

  // 3. Conglomerate Hierarchy / Holdings (HOLD)
  if (
    text.includes("holding") ||
    text.includes("subsidiary") ||
    text.includes("होल्डिंग") ||
    text.includes("সহযোগী") ||
    text.includes("સબસિડિયરી") ||
    text.includes("துணை நிறுவனம்") ||
    text.includes("group")
  ) {
    return `${symbol} HOLD`;
  }

  // 4. Financial Statements (FA)
  if (
    text.includes("financial") ||
    text.includes("balance sheet") ||
    text.includes("बैलेंस शीट") ||
    text.includes("वित्तीय") ||
    text.includes("ফলাফল") ||
    text.includes("નાણાકીય") ||
    text.includes("நிதிநிலை") ||
    text.includes("లాభం")
  ) {
    return `${symbol} FA`;
  }

  // 5. Options Chain (OMON)
  if (
    text.includes("option") ||
    text.includes("ऑप्शन") ||
    text.includes("অপশন") ||
    text.includes("ઓપ્શન") ||
    text.includes("ஆப்ஷன்") ||
    text.includes("chain")
  ) {
    return `NIFTY OMON`;
  }

  // 6. Yield Curve (GC IN)
  if (
    text.includes("yield") ||
    text.includes("यील्ड") ||
    text.includes("ইল্ড") ||
    text.includes("યીલ્ડ") ||
    text.includes("ஈவு") ||
    text.includes("bond") ||
    text.includes("gsec")
  ) {
    return `GC IN`;
  }

  // 7. Surveillance (SURV)
  if (
    text.includes("surveillance") ||
    text.includes("sebi") ||
    text.includes("निगरानी") ||
    text.includes("নজরদারি") ||
    text.includes("સર્વેલન્સ") ||
    text.includes("asm")
  ) {
    return `SURV`;
  }

  // 8. Market Watch (MOST)
  if (
    text.includes("market watch") ||
    text.includes("gainers") ||
    text.includes("losers") ||
    text.includes("मार्केट वॉच") ||
    text.includes("गेनर्स") ||
    text.includes("બજાર")
  ) {
    return `MOST`;
  }

  return `${symbol} DES`;
}
