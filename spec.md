# Healing Frequency Player

## Current State
App has 9 mood cards: 8 standard healing frequency tones + 1 "Libido Booster" with binaural + gamma layers. Audio is generated via Web Audio API (sine oscillators). The `MoodData` interface supports `binauralBeat` and `gammaBurst` fields.

## Requested Changes (Diff)

### Add
- **Brain Theta Waves** card: 6 Hz theta binaural beat layered over a 432 Hz carrier tone. Promotes deep relaxation, meditation, memory, and creativity. Uses `binauralBeat: 6` (left ear: 432 Hz, right ear: 438 Hz).
- **OM 136.1 Hz (Cosmic Frequency)** card: Pure 136.1 Hz tone, the resonant frequency of Earth's year (Om/Aum frequency). Promotes grounding, spiritual connection, and inner peace.

### Modify
- `MOODS` array: append the two new entries.

### Remove
- Nothing removed.

## Implementation Plan
1. Add `Brain Theta Waves` entry to MOODS with hz: 432, binauralBeat: 6, hue ~260 (indigo/deep blue), emoji 🧠, description "Deep relaxation, meditation & creativity".
2. Add `OM 136.1 Hz` entry to MOODS with hz: 136.1, hue ~45 (golden/amber), emoji 🕉️, description "Cosmic grounding, Earth's resonance".
3. The existing audio engine already handles fractional Hz (oscillator frequency accepts floats) and binaural beats — no engine changes needed.
4. Update `data-ocid` indices for the two new cards (10 and 11).
