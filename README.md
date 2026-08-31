# Empathetic AI Companion

Build a full-stack AI web application named “EmoSense AI” using Firebase as backend.

Core Objective:

Create an intelligent emotional support system that detects user emotions and provides context-aware, behavior-aware responses.

Frontend:

- Chat-based UI (modern, minimal, WhatsApp-like)

- Built with React or similar framework

- Clean dark theme (blue/purple calming colors)

- Real-time message updates

Backend (Firebase):

- Firebase Authentication (anonymous or email login)

- Firestore Database to store:

  - Chat history

  - User emotional patterns

  - Behavior data (timestamps, frequency)

- Firebase Functions for:

  - Processing user input

  - Calling NLP models

  - Calculating risk level

AI Integration:

- Use Hugging Face or API-based NLP models

- Detect:

  - Sentiment (positive/negative/neutral)

  - Emotion (stress, anxiety, sadness)

- Generate human-like responses

Behavior Tracking:

- Track:

  - Response delay (timestamps)

  - Message length

  - Interaction frequency

- Use this data to adjust response tone

Risk Detection System:

- Combine emotion + behavior

- Classify:

  - Low risk

  - Moderate risk

  - High risk

Core Features:

1. AI Chat Companion (friendly, non-judgmental tone)

2. Smart Check-ins (triggered by inactivity or negative patterns)

3. Panic Button:

   - Immediate alert system

   - Show emergency support message

4. Trusted Contact:

   - Store emergency contact

   - Trigger alert (notification/email) in high-risk cases

5. Mood Dashboard:

   - Show simple mood trends over time

Security & Privacy:

- Store minimal data

- Use Firebase security rules

- Ensure user consent

Design Guidelines:

- Minimal UI

- Soft glowing colors

- Calm and safe experience

Constraints:

- Not a medical diagnosis tool

- Focus on emotional support

Output:

- Fully working prototype

- Firebase connected backend

- Real-time chat + emotion detection

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://emosense-companion.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2169c560-4a11-4b14-ab1d-00e21a329dcf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
