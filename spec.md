# Healing Frequency Player

## Current State
The app has 8 main mood cards and 4 special cards (Libido Booster, Brain Theta Waves, OHKS, 4-4-4-4) shown in a "You May Also Like" section. All cards are freely accessible. Session logging is available for signed-in users. No payment or trial system exists.

## Requested Changes (Diff)

### Add
- 7-day free trial tracking per user (using first-visit timestamp stored in backend)
- Stripe payment integration for a monthly "Premium" subscription that unlocks the 4 special cards
- Backend endpoints: `getTrialStatus` (returns trial start time and whether trial is active), `startTrial` (records first visit), `checkPremiumAccess` (returns whether user has active premium subscription)
- Stripe checkout session creation and webhook handling via Caffeine Stripe component
- Premium lock overlay on special cards when trial is expired and user is not subscribed
- Upgrade/paywall modal or screen shown when a locked card is clicked
- Trial countdown banner showing days remaining during free trial

### Modify
- Special card click behavior: check access before opening the player; if locked, show upgrade prompt instead
- Backend to include trial start tracking alongside session logging

### Remove
- Nothing removed

## Implementation Plan
1. Select `authorization` and `stripe` Caffeine components
2. Generate Motoko backend with trial tracking, premium access check, and Stripe subscription management
3. Update frontend to:
   a. On first visit/sign-in, call `startTrial` to record trial start
   b. Call `getTrialStatus` to determine if trial is still active
   c. Check premium status via Stripe component hooks
   d. Show lock overlay on special cards if trial expired and not premium
   e. Show trial countdown banner when trial is active
   f. Show upgrade modal/screen with Stripe checkout when locked card is tapped
