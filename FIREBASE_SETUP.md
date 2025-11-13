# Firebase Setup Guide

This document outlines the steps required to configure Firebase for the Sladesh Ultimate app.

## Prerequisites

- Firebase account (sign up at https://firebase.google.com/)
- Firebase CLI installed (optional, for deployment): `npm install -g firebase-tools`

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select existing project
3. Follow the setup wizard:
   - Enter project name: `sladeshultimate-1` (or your preferred name)
   - Enable/disable Google Analytics (optional)
   - Click "Create project"

## Step 2: Enable Firebase Authentication

1. In Firebase Console, go to **Authentication**
2. Click "Get started"
3. Click on **Sign-in method** tab
4. Enable the following providers:
   - **Email/Password**: Click, toggle "Enable", click "Save"
   - **Google** (optional): Click, toggle "Enable", configure OAuth consent screen, click "Save"
   - **Apple** (optional): Click, toggle "Enable", configure Apple Sign In, click "Save"

## Step 3: Create Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click "Create database"
3. Choose **Production mode** (rules will be configured separately)
4. Select a location (choose closest to your users)
5. Click "Enable"

## Step 4: Configure Environment Variables

Create a `.env` file in the `apps/web` directory with your Firebase configuration:

```env
VITE_FB_API_KEY=your_api_key_here
VITE_FB_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FB_PROJECT_ID=your_project_id
VITE_FB_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FB_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FB_APP_ID=your_app_id
```

### How to get these values:

1. In Firebase Console, click the gear icon ⚙️ next to "Project Overview"
2. Click "Project settings"
3. Scroll down to "Your apps" section
4. If you haven't created a web app yet:
   - Click the web icon `</>`
   - Register app with a nickname (e.g., "Sladesh Web")
   - Copy the config values
5. If you already have a web app, click it to see the config values

## Step 5: Deploy Firestore Rules and Indexes

### Option A: Using Firebase CLI (Recommended)

1. Login to Firebase CLI:
   ```bash
   firebase login
   ```

2. Initialize Firebase (if not already done):
   ```bash
   firebase init firestore
   ```
   - Select existing project
   - Use existing `firestore.rules` file (yes)
   - Use existing `firestore.indexes.json` file (yes)

3. Deploy rules and indexes:
   ```bash
   firebase deploy --only firestore:rules
   firebase deploy --only firestore:indexes
   ```

### Option B: Manual Upload via Console

1. **Deploy Rules:**
   - Go to **Firestore Database** → **Rules** tab
   - Copy contents of `firestore.rules` file
   - Paste into the rules editor
   - Click "Publish"

2. **Deploy Indexes:**
   - Go to **Firestore Database** → **Indexes** tab
   - Click "Add Index"
   - For each index in `firestore.indexes.json`, create it manually:
     - Collection: e.g., `users`
     - Fields: e.g., `fullName` (Ascending)
     - Click "Create"

## Step 6: Verify Setup

1. **Test Authentication:**
   - Start your app: `npm run dev`
   - Try signing up with email/password
   - Check Firebase Console → Authentication to see new user

2. **Test Firestore:**
   - After signup, check Firebase Console → Firestore Database
   - You should see:
     - A `users` collection with a document for the new user
     - A `stats` collection with a `global` document (if stats were initialized)

3. **Test Rules:**
   - Try accessing Firestore data in your app
   - Check browser console for any permission errors
   - Adjust rules if needed

## Database Structure Overview

### Collections:

- **`users`** - User profiles and data
  - Document ID = Firebase Auth UID
  - Contains: profile info, activity counts, channel memberships
  - Subcollections: `drinks`, `checkIns`, `sladesh`

- **`channels`** - Social channels/groups
  - Contains: channel info, member list
  - Subcollections: `members`, `comments`, `notifications`

- **`stats`** - Aggregated statistics
  - Document ID: `global`
  - Contains: total counts, drink type breakdowns

## Important Notes

1. **Security Rules**: The provided `firestore.rules` file allows authenticated users to read/write their own data. In production, you may want to add additional restrictions and admin checks.

2. **Indexes**: Some queries require composite indexes. If you see errors about missing indexes, check the Firebase Console for automatic index creation links, or manually create them based on `firestore.indexes.json`.

3. **Stats Updates**: The stats collection is updated automatically when users are created or activities are tracked. Ensure the stats document exists (it will be created automatically on first use).

4. **User Creation**: When a user signs up, a Firestore user document is automatically created via the `useAuth` hook calling `createUser` from `userService.js`.

## Troubleshooting

### Common Issues:

1. **"Firebase: Error (auth/operation-not-allowed)"**
   - Solution: Enable Email/Password authentication in Firebase Console

2. **"Missing or insufficient permissions"**
   - Solution: Deploy Firestore rules using `firebase deploy --only firestore:rules`

3. **"The query requires an index"**
   - Solution: Click the link in the error message to create the index automatically, or manually create it in Firebase Console

4. **Environment variables not loading**
   - Solution: Ensure `.env` file is in `apps/web` directory and restart dev server

5. **"Cannot read property 'uid' of null"**
   - Solution: Wait for auth state to load before accessing `currentUser`

## Next Steps

After setup is complete:
1. Integrate authentication in your Auth component
2. Connect your app components to Firestore services
3. Test all CRUD operations
4. Consider setting up Firebase Storage if you need file uploads
5. Set up error tracking (Firebase Crashlytics) for production

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firestore Indexes](https://firebase.google.com/docs/firestore/query-data/indexing)
