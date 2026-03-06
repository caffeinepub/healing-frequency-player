import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Toaster } from "@/components/ui/sonner";
import { useActor } from "@/hooks/useActor";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import {
  ChevronLeft,
  LogIn,
  LogOut,
  Pause,
  Play,
  Square,
  Waves,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/* ── Mood data ───────────────────────────────────────────────────── */
interface MoodData {
  mood: string;
  hz: number;
  description: string;
  emoji: string;
  hue: number; // used for per-card accent color
  binauralBeat?: number; // Hz difference for binaural beat (left: hz, right: hz+binauralBeat)
  gammaBurst?: boolean; // if true, layer subtle 40 Hz gamma bursts
}

const MOODS: MoodData[] = [
  {
    mood: "Anxious",
    hz: 396,
    description: "Liberating guilt and fear",
    emoji: "🌊",
    hue: 210,
  },
  {
    mood: "Sad",
    hz: 417,
    description: "Undoing situations, facilitating change",
    emoji: "🌸",
    hue: 320,
  },
  {
    mood: "Stressed",
    hz: 528,
    description: "Transformation and miracles",
    emoji: "✨",
    hue: 160,
  },
  {
    mood: "Tired",
    hz: 174,
    description: "Pain reduction, foundation",
    emoji: "🌙",
    hue: 240,
  },
  {
    mood: "Unfocused",
    hz: 852,
    description: "Awakening intuition",
    emoji: "🔮",
    hue: 280,
  },
  {
    mood: "Angry",
    hz: 639,
    description: "Connecting relationships",
    emoji: "🔥",
    hue: 30,
  },
  {
    mood: "Calm",
    hz: 741,
    description: "Expression and solutions",
    emoji: "🍃",
    hue: 150,
  },
  {
    mood: "Happy",
    hz: 963,
    description: "Divine consciousness",
    emoji: "☀️",
    hue: 80,
  },
  {
    mood: "Libido Booster",
    hz: 417,
    description: "Vitality and sensual awakening",
    emoji: "🌹",
    hue: 340,
    binauralBeat: 6,
    gammaBurst: true,
  },
  {
    mood: "Brain Theta Waves",
    hz: 432,
    description: "Deep relaxation, meditation & creativity",
    emoji: "🧠",
    hue: 260,
    binauralBeat: 6,
  },
  {
    mood: "OM 136.1 Hz",
    hz: 136.1,
    description: "Cosmic grounding, Earth's resonance",
    emoji: "🕉️",
    hue: 45,
  },
];

/* ── Audio engine hook ───────────────────────────────────────────── */
type AudioState = "stopped" | "playing" | "paused";

function useAdvancedAudioEngine(
  hz: number,
  volume: number,
  binauralBeat?: number,
  gammaBurst?: boolean,
) {
  const ctxRef = useRef<AudioContext | null>(null);
  // Standard or binaural oscillators
  const oscLeftRef = useRef<OscillatorNode | null>(null);
  const oscRightRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  // Gamma burst oscillator & gain
  const oscGammaRef = useRef<OscillatorNode | null>(null);
  const gammaGainRef = useRef<GainNode | null>(null);
  const gammaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimeRef = useRef<number | null>(null);
  const accumulatedRef = useRef<number>(0);
  const [state, setState] = useState<AudioState>("stopped");

  // Keep main gain in sync with volume slider while playing
  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.setTargetAtTime(
        volume / 100,
        gainRef.current.context.currentTime,
        0.05,
      );
    }
  }, [volume]);

  const stopOscillators = useCallback(() => {
    // Clear gamma interval first
    if (gammaIntervalRef.current !== null) {
      clearInterval(gammaIntervalRef.current);
      gammaIntervalRef.current = null;
    }
    oscLeftRef.current?.stop();
    oscLeftRef.current = null;
    oscRightRef.current?.stop();
    oscRightRef.current = null;
    oscGammaRef.current?.stop();
    oscGammaRef.current = null;
    gainRef.current = null;
    gammaGainRef.current = null;
  }, []);

  const play = useCallback(() => {
    if (state === "playing") return;

    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") void ctx.resume();

    // Main gain node
    const gain = ctx.createGain();
    gain.gain.value = volume / 100;
    gain.connect(ctx.destination);
    gainRef.current = gain;

    if (binauralBeat !== undefined) {
      // Binaural: two oscillators panned left/right
      const oscL = ctx.createOscillator();
      oscL.type = "sine";
      oscL.frequency.value = hz;

      const oscR = ctx.createOscillator();
      oscR.type = "sine";
      oscR.frequency.value = hz + binauralBeat;

      const panL = ctx.createStereoPanner();
      panL.pan.value = -1;
      const panR = ctx.createStereoPanner();
      panR.pan.value = 1;

      oscL.connect(panL);
      panL.connect(gain);
      oscR.connect(panR);
      panR.connect(gain);

      oscL.start();
      oscR.start();

      oscLeftRef.current = oscL;
      oscRightRef.current = oscR;
    } else {
      // Standard: single oscillator, no panning
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = hz;
      osc.connect(gain);
      osc.start();
      oscLeftRef.current = osc;
    }

    if (gammaBurst) {
      // Gamma burst oscillator at 40 Hz with separate low-gain node
      const gammaOsc = ctx.createOscillator();
      gammaOsc.type = "sine";
      gammaOsc.frequency.value = 40;

      const gammaGain = ctx.createGain();
      gammaGain.gain.value = 0;

      gammaOsc.connect(gammaGain);
      gammaGain.connect(ctx.destination);
      gammaOsc.start();

      oscGammaRef.current = gammaOsc;
      gammaGainRef.current = gammaGain;

      // Schedule repeating gamma pulses every 2000ms
      const scheduleGammaPulse = () => {
        const g = gammaGainRef.current;
        const c = ctxRef.current;
        if (!g || !c) return;
        const now = c.currentTime;
        g.gain.linearRampToValueAtTime(0.08, now + 0.05);
        g.gain.linearRampToValueAtTime(0, now + 0.05 + 0.1);
      };

      scheduleGammaPulse();
      gammaIntervalRef.current = setInterval(scheduleGammaPulse, 2000);
    }

    startTimeRef.current = Date.now();
    setState("playing");
  }, [state, hz, volume, binauralBeat, gammaBurst]);

  const pause = useCallback(() => {
    if (state !== "playing") return;
    if (startTimeRef.current !== null) {
      accumulatedRef.current += (Date.now() - startTimeRef.current) / 1000;
    }
    stopOscillators();
    startTimeRef.current = null;
    setState("paused");
  }, [state, stopOscillators]);

  const stop = useCallback((): number => {
    let total = accumulatedRef.current;
    if (state === "playing" && startTimeRef.current !== null) {
      total += (Date.now() - startTimeRef.current) / 1000;
    }
    stopOscillators();
    startTimeRef.current = null;
    accumulatedRef.current = 0;
    setState("stopped");
    return Math.floor(total);
  }, [state, stopOscillators]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      stopOscillators();
      void ctxRef.current?.close();
    };
  }, [stopOscillators]);

  return { state, play, pause, stop };
}

/* ── Background mesh ─────────────────────────────────────────────── */
function BackgroundMesh() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0" aria-hidden>
      {/* Base gradient */}
      <div className="absolute inset-0 bg-background" />
      {/* Atmospheric blobs */}
      <div
        className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-20"
        style={{
          background:
            "radial-gradient(circle, oklch(0.65 0.22 290 / 0.5) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      <div
        className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full opacity-15"
        style={{
          background:
            "radial-gradient(circle, oklch(0.72 0.19 195 / 0.5) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      <div
        className="absolute -bottom-40 left-1/3 w-[400px] h-[400px] rounded-full opacity-10"
        style={{
          background:
            "radial-gradient(circle, oklch(0.80 0.20 205 / 0.4) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
    </div>
  );
}

/* ── Auth button ─────────────────────────────────────────────────── */
function AuthButton() {
  const { identity, login, clear, isLoggingIn } = useInternetIdentity();
  const isLoggedIn = !!identity;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={isLoggedIn ? clear : login}
      disabled={isLoggingIn}
      className="text-muted-foreground hover:text-foreground gap-2 text-xs"
    >
      {isLoggedIn ? (
        <>
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </>
      ) : (
        <>
          <LogIn className="w-3.5 h-3.5" />
          {isLoggingIn ? "Signing in…" : "Sign in"}
        </>
      )}
    </Button>
  );
}

/* ── Mood Selector ───────────────────────────────────────────────── */
interface MoodSelectorProps {
  onSelect: (mood: MoodData) => void;
}

function MoodSelector({ onSelect }: MoodSelectorProps) {
  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <Waves
            className="w-5 h-5"
            style={{ color: "oklch(0.72 0.19 195)" }}
          />
          <span
            className="font-display text-sm font-semibold tracking-wide"
            style={{ color: "oklch(0.72 0.19 195)" }}
          >
            HealTone
          </span>
        </div>
        <AuthButton />
      </header>

      {/* Hero text */}
      <main className="flex-1 flex flex-col items-center px-6 pt-8 pb-16">
        <div
          className="animate-fade-up opacity-0 text-center mb-3"
          style={{ animationDelay: "0ms" }}
        >
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold leading-tight tracking-tight">
            How are you{" "}
            <span
              className="italic text-glow"
              style={{ color: "oklch(0.72 0.19 195)" }}
            >
              feeling?
            </span>
          </h1>
        </div>
        <div
          className="animate-fade-up opacity-0 text-center mb-12"
          style={{ animationDelay: "80ms" }}
        >
          <p className="text-muted-foreground text-sm sm:text-base max-w-md leading-relaxed">
            Choose your current state and let healing frequencies guide your
            body and mind toward balance.
          </p>
        </div>

        {/* Mood grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-3xl">
          {MOODS.map((m, i) => (
            <button
              key={m.mood}
              type="button"
              data-ocid={`mood.card.${i + 1}`}
              onClick={() => onSelect(m)}
              className={`animate-fade-up opacity-0 mood-card-${i + 1} group relative glass-card rounded-2xl p-5 text-left transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60`}
              style={
                {
                  "--card-hue": m.hue,
                } as React.CSSProperties
              }
            >
              {/* Hover glow border */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{
                  boxShadow: `0 0 0 1px oklch(0.72 0.22 ${m.hue} / 0.5), 0 0 24px oklch(0.72 0.22 ${m.hue} / 0.2)`,
                }}
              />

              <div className="text-2xl mb-3 leading-none">{m.emoji}</div>
              <div className="font-display font-semibold text-base leading-tight mb-1">
                {m.mood}
              </div>

              <div className="text-xs text-muted-foreground leading-snug">
                {m.description}
              </div>
            </button>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 px-6">
        <p className="text-xs text-muted-foreground/50">
          © {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground transition-colors underline underline-offset-2"
          >
            caffeine.ai
          </a>
        </p>
      </footer>
    </div>
  );
}

/* ── Frequency Player ────────────────────────────────────────────── */
interface FrequencyPlayerProps {
  mood: MoodData;
  onBack: () => void;
}

function FrequencyPlayer({ mood, onBack }: FrequencyPlayerProps) {
  const [volume, setVolume] = useState(50);
  const { state, play, pause, stop } = useAdvancedAudioEngine(
    mood.hz,
    volume,
    mood.binauralBeat,
    mood.gammaBurst,
  );
  const { actor } = useActor();
  const { identity } = useInternetIdentity();

  const isPlaying = state === "playing";

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const handleStop = async () => {
    const duration = stop();
    if (duration <= 0) return;

    const isLoggedIn = !!identity;
    if (!isLoggedIn || !actor) return;

    try {
      await actor.logSession(mood.mood, BigInt(mood.hz), BigInt(duration));
      toast.success("Session saved", {
        description: `${mood.mood} · ${mood.hz} Hz · ${duration}s`,
        duration: 4000,
      });
    } catch {
      // silently skip logging errors
    }
  };

  const handleBack = () => {
    stop();
    onBack();
  };

  const orbColor = `oklch(0.72 0.22 ${mood.hue})`;
  const orbColorDim = `oklch(0.65 0.18 ${mood.hue} / 0.6)`;
  const orbColorFaint = `oklch(0.60 0.15 ${mood.hue} / 0.15)`;

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5">
        <button
          type="button"
          data-ocid="player.back_button"
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          Back
        </button>
        <AuthButton />
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16 gap-10">
        {/* Mood & frequency label */}
        <div className="text-center animate-fade-up opacity-0">
          <div className="text-3xl mb-3">{mood.emoji}</div>
          <h2 className="font-display text-4xl sm:text-5xl font-semibold mb-2">
            {mood.mood}
          </h2>
          <p
            className="text-xs uppercase tracking-widest font-medium"
            style={{ color: "oklch(0.60 0.10 255)" }}
          >
            {mood.description}
          </p>
        </div>

        {/* Orb */}
        <div className="relative flex items-center justify-center w-52 h-52 sm:w-64 sm:h-64">
          {/* Expanding ring — only when playing */}
          {isPlaying && (
            <>
              <div
                className="absolute inset-0 rounded-full animate-orb-ring"
                style={{
                  background: `radial-gradient(circle, ${orbColorFaint} 0%, transparent 70%)`,
                  border: `1px solid ${orbColorDim}`,
                }}
              />
              <div
                className="absolute inset-4 rounded-full animate-orb-ring"
                style={{
                  animationDelay: "0.8s",
                  background: `radial-gradient(circle, ${orbColorFaint} 0%, transparent 70%)`,
                  border: `1px solid ${orbColorDim}`,
                }}
              />
            </>
          )}

          {/* Core orb */}
          <div
            className={`relative w-40 h-40 sm:w-48 sm:h-48 rounded-full ${isPlaying ? "animate-orb-pulse" : "animate-float"}`}
            style={{
              background: `radial-gradient(circle at 35% 35%, ${orbColor}, ${orbColorDim} 50%, oklch(0.20 0.08 ${mood.hue}) 100%)`,
              boxShadow: `0 0 40px ${orbColorDim}, 0 0 80px oklch(0.65 0.18 ${mood.hue} / 0.3), inset 0 0 30px oklch(0.20 0.08 ${mood.hue} / 0.5)`,
            }}
          >
            {/* Inner light spot */}
            <div
              className="absolute top-1/4 left-1/4 w-1/4 h-1/4 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, white / 0.4, transparent 70%)",
                opacity: 0.35,
              }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            data-ocid="player.play_button"
            onClick={handlePlayPause}
            className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            style={{
              background: `linear-gradient(135deg, ${orbColor}, ${orbColorDim})`,
              boxShadow: `0 0 24px ${orbColorDim}, 0 4px 16px rgba(0,0,0,0.4)`,
            }}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 text-white" fill="white" />
            ) : (
              <Play
                className="w-6 h-6 text-white translate-x-0.5"
                fill="white"
              />
            )}
          </button>

          <button
            type="button"
            data-ocid="player.stop_button"
            onClick={handleStop}
            disabled={state === "stopped"}
            className="w-12 h-12 rounded-full flex items-center justify-center glass-card transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            aria-label="Stop and save session"
          >
            <Square
              className="w-4 h-4 text-foreground/70"
              fill="currentColor"
            />
          </button>
        </div>

        {/* Volume slider */}
        <div className="w-full max-w-xs flex flex-col items-center gap-3">
          <div className="flex justify-between w-full text-xs text-muted-foreground">
            <span>Volume</span>
            <span>{volume}%</span>
          </div>
          <Slider
            data-ocid="player.volume_input"
            min={0}
            max={100}
            step={1}
            value={[volume]}
            onValueChange={([v]) => setVolume(v)}
            className="w-full"
          />
        </div>

        {/* Session saved toast anchor */}
        <div data-ocid="session.success_state" className="hidden" />

        {/* Listening tip */}
        {isPlaying && (
          <p
            className="text-xs text-center max-w-xs leading-relaxed px-4 py-2.5 rounded-xl"
            style={{
              color: `oklch(0.78 0.12 ${mood.hue})`,
              background: `oklch(0.72 0.22 ${mood.hue} / 0.08)`,
              border: `1px solid oklch(0.72 0.22 ${mood.hue} / 0.18)`,
            }}
          >
            🎧 Use headphones for best results &amp; keep the volume at a
            comfortable level.
          </p>
        )}

        {/* Help text */}
        <p className="text-xs text-muted-foreground/40 text-center max-w-xs leading-relaxed">
          {identity
            ? "Sessions are saved when you press stop."
            : "Sign in to save your sessions."}
        </p>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 px-6">
        <p className="text-xs text-muted-foreground/50">
          © {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground transition-colors underline underline-offset-2"
          >
            caffeine.ai
          </a>
        </p>
      </footer>
    </div>
  );
}

/* ── App root ────────────────────────────────────────────────────── */
export default function App() {
  const [selectedMood, setSelectedMood] = useState<MoodData | null>(null);

  return (
    <div className="noise-overlay relative">
      <BackgroundMesh />
      {selectedMood ? (
        <FrequencyPlayer
          mood={selectedMood}
          onBack={() => setSelectedMood(null)}
        />
      ) : (
        <MoodSelector onSelect={setSelectedMood} />
      )}
      <Toaster
        theme="dark"
        position="bottom-center"
        toastOptions={{
          style: {
            background: "oklch(0.18 0.04 265 / 0.95)",
            border: "1px solid oklch(0.32 0.06 265)",
            color: "oklch(0.93 0.02 240)",
            backdropFilter: "blur(12px)",
          },
        }}
      />
    </div>
  );
}
