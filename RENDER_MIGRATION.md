# Render Migration Guide

This app can keep using Firebase Authentication and Cloud Firestore, while moving the AI backend to Render so you do not need Firebase Functions or the Blaze plan for AI.

## Recommended architecture

- Firebase Auth: keep
- Cloud Firestore: keep
- Render Web Service: new AI backend
- OpenAI API: called only from the Render backend

This avoids putting your OpenAI key in the mobile app and avoids deploying Firebase Functions.

## Why this is the best low-cost option

- Firebase Auth and Firestore can keep working on their free quota.
- The AI backend is the part most likely to require Blaze if you host it as Firebase Functions.
- Render can host the AI endpoint separately, and the app already supports a generic `EXPO_PUBLIC_AI_API_URL`.

## Files added for Render

- `render-backend/package.json`
- `render-backend/server.js`
- `render-backend/render.yaml`

## Render setup

1. Create a new Web Service on Render.
2. Point it to this repo.
3. Set the root directory to `render-backend`.
4. Render can use the included `render.yaml`, or you can configure manually.

### Environment variables to add in Render

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

### Firebase Admin credentials

Create a Firebase service account in Firebase Console:

1. Project settings
2. Service accounts
3. Generate new private key

Then copy values into Render environment variables:

- `project_id` -> `FIREBASE_PROJECT_ID`
- `client_email` -> `FIREBASE_CLIENT_EMAIL`
- `private_key` -> `FIREBASE_PRIVATE_KEY`

For `FIREBASE_PRIVATE_KEY`, keep the full key and preserve line breaks. If Render strips line breaks, paste it with `\n` and the backend will convert it.

## Mobile app setup

Create a `.env` file in the app root:

```env
EXPO_PUBLIC_AI_API_URL=https://your-render-service.onrender.com/ai-coach
```

Then restart Expo.

## Testing

### AI health check

Open:

`https://your-render-service.onrender.com/health`

You should see:

```json
{ "ok": true }
```

### App test

1. Sign in
2. Create a goal
3. Open AI Coach
4. Confirm suggestions load

## Notes

- Do not deploy Firebase Functions if you want to avoid Blaze-related AI hosting.
- The app still uses Firebase Auth and Firestore, which is fine as long as your usage stays within Spark/free limits.
