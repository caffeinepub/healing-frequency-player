import { UpgradeModal } from "@/components/UpgradeModal";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Toaster } from "@/components/ui/sonner";
import { useActor } from "@/hooks/useActor";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import { usePremium } from "@/hooks/usePremium";
import {
  ChevronLeft,
  LogIn,
  LogOut,
  Pause,
  Play,
  Sparkles,
  Square,
  Waves,
} from "lucide-react";
import { LockKeyhole } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/* ── Mood data ───────────────────────────────────────────────────── */
interface BreathingPhase {
  label: string;
  type: "inhale" | "hold" | "exhale";
  duration: number;
  carrierOffset: number;
}

interface BreathingBinaural {
  baseCarrier: number;
  binauralHz: number;
  phases: BreathingPhase[];
}

interface MoodData {
  mood: string;
  hz: number;
  description: string;
  emoji: string;
  hue: number;
  binauralBeat?: number;
  gammaBurst?: boolean;
  sequenceFreqs?: { label: string; hz: number; carrierHz: number }[];
  breathingBinaural?: BreathingBinaural;
}

const MAIN_MOODS: MoodData[] = [
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
];

const SPECIAL_MOODS: MoodData[] = [
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
    mood: "OHKS",
    hz: 7.83,
    description: "Sacred bija mantras · Schumann to divine",
    emoji: "🕉️",
    hue: 55,
    sequenceFreqs: [
      { label: "Om (ॐ)", hz: 7.83, carrierHz: 136.1 },
      { label: "Hreem (ह्रीं)", hz: 26, carrierHz: 285 },
      { label: "Kleem (क्लीं)", hz: 33, carrierHz: 396 },
      { label: "Shreem (श्रीं)", hz: 45, carrierHz: 528 },
    ],
  },
  {
    mood: "4-4-4-4",
    hz: 100,
    description: "40 Hz gamma · box breathing · calm focus",
    emoji: "🌬️",
    hue: 195,
    breathingBinaural: {
      baseCarrier: 100,
      binauralHz: 40,
      phases: [
        { label: "Inhale", type: "inhale", duration: 4, carrierOffset: 0 },
        { label: "Hold", type: "hold", duration: 4, carrierOffset: 0.5 },
        { label: "Exhale", type: "exhale", duration: 4, carrierOffset: 1 },
        { label: "Hold", type: "hold", duration: 4, carrierOffset: 0.5 },
      ],
    },
  },
];

/* ── Shared chime helper (used by OHKS sequence) ─────────────────── */
function playChime(ctx: AudioContext, volume: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.value = volume * 0.08;
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.25);
}

/* ── Breathing phase chime (used by 4-4-4-4) ────────────────────── */
function playBreathingPhaseChime(
  ctx: AudioContext,
  volume: number,
  phaseType: "inhale" | "hold" | "exhale",
) {
  const baseGain = volume * 0.25;
  const now = ctx.currentTime;

  const playNote = (freq: number, startOffset: number, duration: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, now + startOffset);
    gain.gain.linearRampToValueAtTime(baseGain, now + startOffset + 0.02);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + startOffset + duration,
    );
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration + 0.05);
  };

  if (phaseType === "inhale") {
    playNote(440, 0, 0.45);
    playNote(550, 0.12, 0.45);
  } else if (phaseType === "hold") {
    playNote(480, 0, 0.55);
  } else {
    playNote(550, 0, 0.45);
    playNote(400, 0.12, 0.45);
  }
}

/* ── Audio engine hook ───────────────────────────────────────────── */
type AudioState = "stopped" | "playing" | "paused";

function useAdvancedAudioEngine(
  hz: number,
  volume: number,
  binauralBeat?: number,
  gammaBurst?: boolean,
) {
  const ctxRef = useRef<AudioContext | null>(null);
  const oscLeftRef = useRef<OscillatorNode | null>(null);
  const oscRightRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const oscGammaRef = useRef<OscillatorNode | null>(null);
  const gammaGainRef = useRef<GainNode | null>(null);
  const gammaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimeRef = useRef<number | null>(null);
  const accumulatedRef = useRef<number>(0);
  const [state, setState] = useState<AudioState>("stopped");

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
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") void ctx.resume();

    const gain = ctx.createGain();
    gain.gain.value = volume / 100;
    gain.connect(ctx.destination);
    gainRef.current = gain;

    if (binauralBeat !== undefined) {
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
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = hz;
      osc.connect(gain);
      osc.start();
      oscLeftRef.current = osc;
    }

    if (gammaBurst) {
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
    if (startTimeRef.current !== null)
      accumulatedRef.current += (Date.now() - startTimeRef.current) / 1000;
    stopOscillators();
    startTimeRef.current = null;
    setState("paused");
  }, [state, stopOscillators]);

  const stop = useCallback((): number => {
    let total = accumulatedRef.current;
    if (state === "playing" && startTimeRef.current !== null)
      total += (Date.now() - startTimeRef.current) / 1000;
    stopOscillators();
    startTimeRef.current = null;
    accumulatedRef.current = 0;
    setState("stopped");
    return Math.floor(total);
  }, [state, stopOscillators]);

  useEffect(() => {
    return () => {
      stopOscillators();
      void ctxRef.current?.close();
    };
  }, [stopOscillators]);

  return { state, play, pause, stop };
}

/* ── Sequence audio engine hook ──────────────────────────────────── */
function useSequenceAudioEngine(
  steps: { label: string; hz: number; carrierHz?: number }[],
  volume: number,
) {
  const STEP_DURATION = 8;

  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const startTimeRef = useRef<number | null>(null);
  const accumulatedRef = useRef<number>(0);
  const stepIndexRef = useRef<number>(0);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, setState] = useState<AudioState>("stopped");
  const [activeStep, setActiveStep] = useState<{
    label: string;
    hz: number;
  } | null>(null);
  const [countdown, setCountdown] = useState<number>(STEP_DURATION);

  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.setTargetAtTime(
        volume / 100,
        gainRef.current.context.currentTime,
        0.05,
      );
    }
  }, [volume]);

  const clearTimers = useCallback(() => {
    if (stepTimerRef.current !== null) {
      clearInterval(stepTimerRef.current);
      stepTimerRef.current = null;
    }
    if (countdownTimerRef.current !== null) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const stopOscillator = useCallback(() => {
    clearTimers();
    oscRef.current?.stop();
    oscRef.current = null;
    gainRef.current = null;
  }, [clearTimers]);

  const startCountdown = useCallback(() => {
    setCountdown(STEP_DURATION);
    let remaining = STEP_DURATION - 1;
    if (countdownTimerRef.current !== null)
      clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      setCountdown(remaining);
      remaining -= 1;
      if (remaining < 0) {
        if (countdownTimerRef.current !== null) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
      }
    }, 1000);
  }, []);

  const advanceStep = useCallback(() => {
    if (!ctxRef.current || !oscRef.current) return;
    if (ctxRef.current) playChime(ctxRef.current, volume / 100);
    stepIndexRef.current = (stepIndexRef.current + 1) % steps.length;
    const nextStep = steps[stepIndexRef.current];
    oscRef.current.frequency.setTargetAtTime(
      nextStep.carrierHz ?? nextStep.hz,
      ctxRef.current.currentTime,
      0.1,
    );
    setActiveStep(nextStep);
    startCountdown();
  }, [steps, volume, startCountdown]);

  const play = useCallback(() => {
    if (state === "playing") return;
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") void ctx.resume();

    const gain = ctx.createGain();
    gain.gain.value = volume / 100;
    gain.connect(ctx.destination);
    gainRef.current = gain;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    const currentStep = steps[stepIndexRef.current];
    osc.frequency.value = currentStep.carrierHz ?? currentStep.hz;
    osc.connect(gain);
    osc.start();
    oscRef.current = osc;
    setActiveStep(currentStep);
    startCountdown();

    stepTimerRef.current = setInterval(() => {
      advanceStep();
    }, STEP_DURATION * 1000);
    startTimeRef.current = Date.now();
    setState("playing");
  }, [state, steps, volume, advanceStep, startCountdown]);

  const pause = useCallback(() => {
    if (state !== "playing") return;
    if (startTimeRef.current !== null)
      accumulatedRef.current += (Date.now() - startTimeRef.current) / 1000;
    stopOscillator();
    startTimeRef.current = null;
    setState("paused");
    setActiveStep(null);
  }, [state, stopOscillator]);

  const stop = useCallback((): number => {
    let total = accumulatedRef.current;
    if (state === "playing" && startTimeRef.current !== null)
      total += (Date.now() - startTimeRef.current) / 1000;
    stopOscillator();
    startTimeRef.current = null;
    accumulatedRef.current = 0;
    stepIndexRef.current = 0;
    setState("stopped");
    setActiveStep(null);
    return Math.floor(total);
  }, [state, stopOscillator]);

  useEffect(() => {
    return () => {
      stopOscillator();
      void ctxRef.current?.close();
    };
  }, [stopOscillator]);

  return { state, play, pause, stop, activeStep, countdown };
}

/* ── Breathing Binaural audio engine hook ────────────────────────── */
interface ActiveBreathingPhase {
  label: string;
  type: "inhale" | "hold" | "exhale";
  phaseIndex: number;
}

function useBreathingBinauralEngine(
  config: BreathingBinaural | undefined,
  volume: number,
) {
  const ctxRef = useRef<AudioContext | null>(null);
  const oscLRef = useRef<OscillatorNode | null>(null);
  const oscRRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseIndexRef = useRef<number>(0);

  const startTimeRef = useRef<number | null>(null);
  const accumulatedRef = useRef<number>(0);

  const [state, setState] = useState<AudioState>("stopped");
  const [activePhase, setActivePhase] = useState<ActiveBreathingPhase | null>(
    null,
  );
  const [countdown, setCountdown] = useState<number>(4);

  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.setTargetAtTime(
        volume / 100,
        gainRef.current.context.currentTime,
        0.05,
      );
    }
  }, [volume]);

  const clearPhaseTimer = useCallback(() => {
    if (phaseTimerRef.current !== null) {
      clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
    if (countdownTimerRef.current !== null) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const stopOscillators = useCallback(() => {
    clearPhaseTimer();
    oscLRef.current?.stop();
    oscLRef.current = null;
    oscRRef.current?.stop();
    oscRRef.current = null;
    gainRef.current = null;
  }, [clearPhaseTimer]);

  const startCountdown = useCallback((duration: number) => {
    setCountdown(duration);
    let remaining = duration - 1;
    if (countdownTimerRef.current !== null)
      clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      setCountdown(remaining);
      remaining -= 1;
      if (remaining < 0) {
        if (countdownTimerRef.current !== null) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
      }
    }, 1000);
  }, []);

  const schedulePhase = useCallback(
    (phases: BreathingPhase[], index: number) => {
      if (!ctxRef.current || !oscLRef.current || !oscRRef.current) return;
      const phase = phases[index];
      const carrier = (config?.baseCarrier ?? 100) + phase.carrierOffset;
      const beat = config?.binauralHz ?? 40;
      const ctx = ctxRef.current;

      oscLRef.current.frequency.setTargetAtTime(carrier, ctx.currentTime, 0.3);
      oscRRef.current.frequency.setTargetAtTime(
        carrier + beat,
        ctx.currentTime,
        0.3,
      );

      setActivePhase({
        label: phase.label,
        type: phase.type,
        phaseIndex: index,
      });
      startCountdown(phase.duration);

      phaseTimerRef.current = setTimeout(() => {
        const nextIndex = (index + 1) % phases.length;
        const nextPhaseType = phases[nextIndex].type;
        if (ctxRef.current)
          playBreathingPhaseChime(ctxRef.current, volume / 100, nextPhaseType);
        phaseIndexRef.current = nextIndex;
        schedulePhase(phases, nextIndex);
      }, phase.duration * 1000);
    },
    [config, volume, startCountdown],
  );

  const play = useCallback(() => {
    if (state === "playing" || !config) return;
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") void ctx.resume();

    const gain = ctx.createGain();
    gain.gain.value = volume / 100;
    gain.connect(ctx.destination);
    gainRef.current = gain;

    const firstPhase = config.phases[phaseIndexRef.current];
    const carrier = config.baseCarrier + firstPhase.carrierOffset;
    const beat = config.binauralHz;

    const oscL = ctx.createOscillator();
    oscL.type = "sine";
    oscL.frequency.value = carrier;
    const panL = ctx.createStereoPanner();
    panL.pan.value = -1;
    oscL.connect(panL);
    panL.connect(gain);
    oscL.start();
    oscLRef.current = oscL;

    const oscR = ctx.createOscillator();
    oscR.type = "sine";
    oscR.frequency.value = carrier + beat;
    const panR = ctx.createStereoPanner();
    panR.pan.value = 1;
    oscR.connect(panR);
    panR.connect(gain);
    oscR.start();
    oscRRef.current = oscR;

    schedulePhase(config.phases, phaseIndexRef.current);

    startTimeRef.current = Date.now();
    setState("playing");
  }, [state, config, volume, schedulePhase]);

  const pause = useCallback(() => {
    if (state !== "playing") return;
    if (startTimeRef.current !== null)
      accumulatedRef.current += (Date.now() - startTimeRef.current) / 1000;
    stopOscillators();
    startTimeRef.current = null;
    setState("paused");
    setActivePhase(null);
  }, [state, stopOscillators]);

  const stop = useCallback((): number => {
    let total = accumulatedRef.current;
    if (state === "playing" && startTimeRef.current !== null)
      total += (Date.now() - startTimeRef.current) / 1000;
    stopOscillators();
    startTimeRef.current = null;
    accumulatedRef.current = 0;
    phaseIndexRef.current = 0;
    setState("stopped");
    setActivePhase(null);
    return Math.floor(total);
  }, [state, stopOscillators]);

  useEffect(() => {
    return () => {
      stopOscillators();
      void ctxRef.current?.close();
    };
  }, [stopOscillators]);

  return { state, play, pause, stop, activePhase, countdown };
}

/* ── Unified audio engine wrapper ────────────────────────────────── */
function useAudioEngine(mood: MoodData, volume: number) {
  const standard = useAdvancedAudioEngine(
    mood.hz,
    volume,
    mood.binauralBeat,
    mood.gammaBurst,
  );
  const sequence = useSequenceAudioEngine(mood.sequenceFreqs ?? [], volume);
  const breathing = useBreathingBinauralEngine(mood.breathingBinaural, volume);

  const isSequence = mood.sequenceFreqs !== undefined;
  const isBreathing = mood.breathingBinaural !== undefined;

  if (isBreathing) {
    return {
      state: breathing.state,
      play: breathing.play,
      pause: breathing.pause,
      stop: breathing.stop,
      activeStep: null,
      activePhase: breathing.activePhase,
      countdown: breathing.countdown,
    };
  }
  if (isSequence) {
    return {
      state: sequence.state,
      play: sequence.play,
      pause: sequence.pause,
      stop: sequence.stop,
      activeStep: sequence.activeStep,
      activePhase: null,
      countdown: sequence.countdown,
    };
  }
  return {
    state: standard.state,
    play: standard.play,
    pause: standard.pause,
    stop: standard.stop,
    activeStep: null,
    activePhase: null,
    countdown: null,
  };
}

/* ── Background mesh ─────────────────────────────────────────────── */
function BackgroundMesh() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0" aria-hidden>
      <div className="absolute inset-0 bg-background" />
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
  isPremiumAccess: boolean;
  isLoading: boolean;
  trialActive: boolean;
  daysLeft: number | null;
}

function MoodSelector({
  onSelect,
  isPremiumAccess,
  isLoading,
  trialActive,
  daysLeft,
}: MoodSelectorProps) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  return (
    <div className="relative z-10 min-h-screen flex flex-col">
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

        {/* Main mood grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-3xl">
          {MAIN_MOODS.map((m, i) => (
            <button
              key={m.mood}
              type="button"
              data-ocid={`mood.card.${i + 1}`}
              onClick={() => onSelect(m)}
              className={`animate-fade-up opacity-0 mood-card-${i + 1} group relative glass-card rounded-2xl p-5 text-left transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60`}
              style={{ "--card-hue": m.hue } as React.CSSProperties}
            >
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

        {/* You May Also Like — special cards */}
        <div className="w-full max-w-3xl mt-14">
          {/* Section divider */}
          <div className="flex items-center gap-4 mb-6">
            <div
              className="flex-1 h-px"
              style={{
                background:
                  "linear-gradient(to right, transparent, oklch(0.72 0.19 195 / 0.25))",
              }}
            />
            <div className="flex items-center gap-2">
              <Sparkles
                className="w-3.5 h-3.5"
                style={{ color: "oklch(0.72 0.19 195 / 0.6)" }}
              />
              <span
                className="text-xs font-medium tracking-widest uppercase"
                style={{ color: "oklch(0.72 0.19 195 / 0.55)" }}
              >
                You May Also Like
              </span>
              {isPremiumAccess && trialActive && daysLeft !== null && (
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    color: "oklch(0.88 0.14 80)",
                    background: "oklch(0.72 0.22 80 / 0.15)",
                    border: "1px solid oklch(0.72 0.22 80 / 0.25)",
                  }}
                >
                  {daysLeft}d free trial
                </span>
              )}
              {isPremiumAccess && !trialActive && !isLoading && (
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    color: "oklch(0.88 0.14 290)",
                    background: "oklch(0.72 0.22 290 / 0.15)",
                    border: "1px solid oklch(0.72 0.22 290 / 0.25)",
                  }}
                >
                  Premium
                </span>
              )}
              <Sparkles
                className="w-3.5 h-3.5"
                style={{ color: "oklch(0.72 0.19 195 / 0.6)" }}
              />
            </div>
            <div
              className="flex-1 h-px"
              style={{
                background:
                  "linear-gradient(to left, transparent, oklch(0.72 0.19 195 / 0.25))",
              }}
            />
          </div>

          {/* Special cards — horizontal layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {SPECIAL_MOODS.map((m, i) => (
              <button
                key={m.mood}
                type="button"
                data-ocid={`special.card.${i + 1}`}
                onClick={() =>
                  isPremiumAccess || isLoading
                    ? onSelect(m)
                    : setUpgradeOpen(true)
                }
                className="group relative flex items-center gap-4 rounded-2xl p-4 text-left transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                style={{
                  background: `oklch(0.16 0.03 ${m.hue} / 0.6)`,
                  border: `1px solid oklch(0.72 0.22 ${m.hue} / 0.18)`,
                  backdropFilter: "blur(12px)",
                }}
              >
                {/* Hover glow */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    boxShadow: `0 0 0 1px oklch(0.72 0.22 ${m.hue} / 0.45), 0 0 20px oklch(0.72 0.22 ${m.hue} / 0.15)`,
                  }}
                />
                {!isPremiumAccess && !isLoading && (
                  <div
                    className="absolute inset-0 rounded-2xl flex items-center justify-center pointer-events-none z-10"
                    style={{
                      background: "oklch(0.10 0.03 265 / 0.55)",
                      backdropFilter: "blur(2px)",
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{
                        background: "oklch(0.18 0.04 265 / 0.9)",
                        border: "1px solid oklch(0.30 0.08 265)",
                      }}
                    >
                      <LockKeyhole
                        className="w-3.5 h-3.5"
                        style={{ color: "oklch(0.72 0.22 290)" }}
                      />
                    </div>
                  </div>
                )}

                {/* Mini orb */}
                <div
                  className="relative shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, oklch(0.72 0.22 ${m.hue}), oklch(0.45 0.18 ${m.hue}))`,
                    boxShadow: `0 0 16px oklch(0.65 0.18 ${m.hue} / 0.4)`,
                  }}
                >
                  {m.emoji}
                </div>

                {/* Text */}
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div
                    className="font-display font-semibold text-sm leading-tight"
                    style={{ color: `oklch(0.88 0.08 ${m.hue})` }}
                  >
                    {m.mood}
                  </div>
                  <div className="text-xs text-muted-foreground leading-snug">
                    {m.description}
                  </div>
                  {/* Badge tag */}
                  <div className="mt-1.5">
                    <span
                      className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider"
                      style={{
                        color: `oklch(0.78 0.14 ${m.hue})`,
                        background: `oklch(0.72 0.22 ${m.hue} / 0.12)`,
                        border: `1px solid oklch(0.72 0.22 ${m.hue} / 0.2)`,
                      }}
                    >
                      {m.binauralBeat !== undefined
                        ? "Binaural · Headphones"
                        : m.sequenceFreqs !== undefined
                          ? "Mantra Sequence"
                          : m.breathingBinaural !== undefined
                            ? "Breathwork · Binaural"
                            : "Special"}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>

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
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}

/* ── Breathing phase indicator ───────────────────────────────────── */
const PHASE_LABELS: { inhale: string; hold: string; exhale: string } = {
  inhale: "Breathe In",
  hold: "Hold",
  exhale: "Breathe Out",
};

function BreathingIndicator({
  phase,
  hue,
  countdown,
}: {
  phase: ActiveBreathingPhase;
  hue: number;
  countdown?: number;
}) {
  const orbColor = `oklch(0.72 0.22 ${hue})`;
  const steps = ["Inhale", "Hold", "Exhale", "Hold"];
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-1">
        <div
          className="text-2xl font-display font-semibold tracking-widest uppercase animate-fade-up opacity-0"
          style={{
            color: orbColor,
            animationDuration: "0.3s",
            animationFillMode: "forwards",
          }}
          key={phase.phaseIndex}
        >
          {PHASE_LABELS[phase.type]}
        </div>
        {countdown !== undefined && countdown > 0 && (
          <div
            className="text-sm font-mono tabular-nums"
            style={{ color: `oklch(0.72 0.22 ${hue} / 0.45)` }}
          >
            {countdown}s
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {steps.map((s, i) => {
          const stepKey = `breathing-step-${i}`;
          return (
            <div key={stepKey} className="flex flex-col items-center gap-1">
              <div
                className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                style={{
                  background:
                    i === phase.phaseIndex
                      ? orbColor
                      : `oklch(0.72 0.22 ${hue} / 0.2)`,
                  transform: i === phase.phaseIndex ? "scale(1.4)" : "scale(1)",
                  boxShadow:
                    i === phase.phaseIndex ? `0 0 8px ${orbColor}` : "none",
                }}
              />
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{
                  color:
                    i === phase.phaseIndex
                      ? orbColor
                      : `oklch(0.72 0.22 ${hue} / 0.35)`,
                  fontWeight: i === phase.phaseIndex ? 600 : 400,
                }}
              >
                {s}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Breathing Ring visual animation ────────────────────────────── */
interface BreathingRingProps {
  phase: ActiveBreathingPhase;
  hue: number;
  targetScale: number;
  phaseDuration: number;
}

function BreathingRing({
  phase,
  hue,
  targetScale,
  phaseDuration,
}: BreathingRingProps) {
  // Determine if this is a "hold" phase — we add a gentle pulse animation
  const isHold = phase.type === "hold";

  return (
    <>
      {/* Primary expanding/contracting ring */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          border: `2px solid oklch(0.75 0.22 ${hue} / 0.55)`,
          boxShadow: `0 0 16px oklch(0.72 0.22 ${hue} / 0.35), inset 0 0 12px oklch(0.72 0.22 ${hue} / 0.1)`,
          transform: `scale(${targetScale})`,
          transition: `transform ${phaseDuration}s ease-in-out, box-shadow ${phaseDuration}s ease-in-out`,
          animation: isHold
            ? "breath-hold-pulse 2s ease-in-out infinite"
            : "none",
        }}
      />
      {/* Outer diffuse halo ring */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          border: `1px solid oklch(0.72 0.22 ${hue} / 0.2)`,
          transform: `scale(${targetScale * 1.12})`,
          transition: `transform ${phaseDuration}s ease-in-out`,
          filter: "blur(3px)",
        }}
      />
    </>
  );
}

/* ── Frequency Player ────────────────────────────────────────────── */
interface FrequencyPlayerProps {
  mood: MoodData;
  onBack: () => void;
}

function FrequencyPlayer({ mood, onBack }: FrequencyPlayerProps) {
  const [volume, setVolume] = useState(50);
  const { state, play, pause, stop, activeStep, activePhase, countdown } =
    useAudioEngine(mood, volume);
  const { actor } = useActor();
  const { identity } = useInternetIdentity();

  const isPlaying = state === "playing";

  const handlePlayPause = () => {
    isPlaying ? pause() : play();
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
      /* silently skip */
    }
  };

  const handleBack = () => {
    stop();
    onBack();
  };

  const orbColor = `oklch(0.72 0.22 ${mood.hue})`;
  const orbColorDim = `oklch(0.65 0.18 ${mood.hue} / 0.6)`;
  const orbColorFaint = `oklch(0.60 0.15 ${mood.hue} / 0.15)`;

  const getBreathingScale = () => {
    if (!activePhase) return 1;
    if (activePhase.type === "inhale") return 1.18;
    if (activePhase.type === "exhale") return 0.88;
    return activePhase.phaseIndex === 1 ? 1.18 : 0.88;
  };
  const breathingScale = mood.breathingBinaural ? getBreathingScale() : 1;

  // Ring target scale — larger than orb scale so it surrounds the orb
  const getRingScale = () => {
    if (!activePhase) return 1;
    if (activePhase.type === "inhale") return 1.6;
    if (activePhase.type === "exhale") return 0.8;
    return activePhase.phaseIndex === 1 ? 1.6 : 0.8;
  };
  const ringScale = getRingScale();
  const phaseDuration = 4; // seconds — matches 4-4-4-4 phase duration

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
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

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16 gap-8">
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

          {/* Breathing ring — only for 4-4-4-4 */}
          {mood.breathingBinaural && isPlaying && activePhase && (
            <BreathingRing
              phase={activePhase}
              hue={mood.hue}
              targetScale={ringScale}
              phaseDuration={phaseDuration}
            />
          )}

          <div
            className={`relative w-40 h-40 sm:w-48 sm:h-48 rounded-full ${
              mood.breathingBinaural
                ? ""
                : isPlaying
                  ? "animate-orb-pulse"
                  : "animate-float"
            }`}
            style={{
              background: `radial-gradient(circle at 35% 35%, ${orbColor}, ${orbColorDim} 50%, oklch(0.20 0.08 ${mood.hue}) 100%)`,
              boxShadow: `0 0 40px ${orbColorDim}, 0 0 80px oklch(0.65 0.18 ${mood.hue} / 0.3), inset 0 0 30px oklch(0.20 0.08 ${mood.hue} / 0.5)`,
              transform: mood.breathingBinaural
                ? `scale(${breathingScale})`
                : undefined,
              transition: mood.breathingBinaural
                ? "transform 3.5s ease-in-out"
                : undefined,
            }}
          >
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

        {isPlaying && activePhase && (
          <BreathingIndicator
            phase={activePhase}
            hue={mood.hue}
            countdown={countdown ?? undefined}
          />
        )}

        {isPlaying && activeStep && (
          <div
            className="flex items-center gap-3 px-4 py-2 rounded-full text-sm font-semibold tracking-wide animate-fade-up opacity-0"
            style={{
              color: orbColor,
              background: `oklch(0.72 0.22 ${mood.hue} / 0.12)`,
              border: `1px solid oklch(0.72 0.22 ${mood.hue} / 0.3)`,
              animationDelay: "0ms",
              animationFillMode: "forwards",
            }}
          >
            <span>{activeStep.label}</span>
            {countdown !== null && countdown > 0 && (
              <span
                className="font-mono text-xs tabular-nums"
                style={{ color: `oklch(0.72 0.22 ${mood.hue} / 0.45)` }}
              >
                {countdown}s
              </span>
            )}
          </div>
        )}

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

        <div data-ocid="session.success_state" className="hidden" />

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

        <p className="text-xs text-muted-foreground/40 text-center max-w-xs leading-relaxed">
          {identity
            ? "Sessions are saved when you press stop."
            : "Sign in to save your sessions."}
        </p>
      </main>

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
  const { isPremium, trialActive, daysLeft, isLoading, refresh } = usePremium();
  const isPremiumAccess = isLoading || isPremium || trialActive;

  // Handle Stripe return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("premium") === "success") {
      void refresh().then(() => {
        toast.success("Premium activated! 🎉", {
          description: "You now have full access to all special frequencies.",
          duration: 5000,
        });
      });
      // clean up URL
      const clean = window.location.pathname;
      window.history.replaceState({}, "", clean);
    }
  }, [refresh]);

  return (
    <div className="noise-overlay relative">
      <BackgroundMesh />
      {selectedMood ? (
        <FrequencyPlayer
          mood={selectedMood}
          onBack={() => setSelectedMood(null)}
        />
      ) : (
        <MoodSelector
          onSelect={setSelectedMood}
          isPremiumAccess={isPremiumAccess}
          isLoading={isLoading}
          trialActive={trialActive}
          daysLeft={daysLeft}
        />
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
