# Healing Frequency Player

## Current State
- 8 mood cards (Anxious, Sad, Stressed, Tired, Unfocused, Angry, Calm, Happy) each mapped to a single healing frequency (hz)
- Audio engine (`useAudioEngine`) plays a single sine-wave oscillator at the selected mood's Hz
- `MoodData` interface: `{ mood, hz, description, emoji, hue }`
- Player page shows orb, play/pause/stop controls, volume slider, headphone tip during playback
- Hz values and "frequency" label are hidden from users
- Sessions logged to backend on stop (if signed in)

## Requested Changes (Diff)

### Add
- New mood card named **"Libido Booster"** (emoji 🌹, warm rose/magenta hue ~340)
- Complex audio layer for this mood:
  - **417 Hz background tone** (standard sine, left + right equally)
  - **6 Hz theta binaural beat** (left ear: 417 Hz, right ear: 423 Hz — 6 Hz difference creates theta binaural effect)
  - **Subtle 40 Hz gamma bursts** (periodic low-amplitude 40 Hz pulse ~every 2 seconds, 200ms duration, ~15% gain)
- `MoodData` interface extended with optional `binauralBeat?: number` and `gammaBurst?: boolean` flags
- New audio engine function/hook `useAdvancedAudioEngine` (or extend existing) to handle multi-oscillator layering for special moods

### Modify
- `MOODS` array: append the new Libido Booster entry
- Audio engine: if `binauralBeat` is set, split stereo — left osc at `hz`, right osc at `hz + binauralBeat`, via `ChannelSplitterNode` / `StereoPannerNode`
- If `gammaBurst` is set, add a periodic low-volume 40 Hz oscillator that pulses on/off every 2s (200ms on)
- `FrequencyPlayer`: detect if `mood.binauralBeat` exists and pass to the enhanced engine
- Grid layout: now 9 cards — keep 2-col on mobile, adjust sm: breakpoint to 3-col (3×3) to fit cleanly

### Remove
- Nothing removed

## Implementation Plan
1. Extend `MoodData` interface with optional `binauralBeat?: number` and `gammaBurst?: boolean`
2. Add Libido Booster entry to `MOODS` array (`hz: 417`, `binauralBeat: 6`, `gammaBurst: true`, `hue: 340`)
3. Create `useAdvancedAudioEngine` hook that:
   - For standard moods: single sine oscillator (existing behavior)
   - When `binauralBeat` is set: two oscillators via StereoPannerNode (left: hz, right: hz+binauralBeat), both connected through a gain
   - When `gammaBurst` is set: add a third oscillator at 40 Hz with very low gain (0.08), scheduled to burst 200ms on / 1800ms off using `gain.setTargetAtTime` scheduling loop
4. Wire `FrequencyPlayer` to use the new hook (passing binauralBeat and gammaBurst from mood)
5. Update grid to `grid-cols-2 sm:grid-cols-3` for 9-card layout
6. Keep all existing data-ocid markers; add `mood.card.9` for the new card
