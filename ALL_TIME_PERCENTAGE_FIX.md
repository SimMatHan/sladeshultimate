# All-Time Percentage View Bug Fix

## Problem Summary

The "All-time percentage" view in ProfileDetails was showing incorrect data because:

1. **Missing Data Field**: The user document didn't have an all-time drink variations field
2. **Fake Data**: The UI was using `drinkTypes` (category totals like "Beer: 10") and faking it into a variation structure
3. **Wrong Percentages**: Percentages were calculated against category totals, not total drinks
4. **No Individual Variations**: It wasn't showing actual drink variations (Lager, IPA, Mojito, etc.)

## Solution

Added a new `allTimeDrinkVariations` field to the user document that:
- Tracks all drink variations over the user's lifetime
- Never resets (unlike `drinkVariations` which resets daily at 10:00)
- Has the same nested structure as `drinkVariations`: `{ "beer": { "Lager": 50, "IPA": 30 }, "cocktail": { "Mojito": 20 } }`

## Changes Made

### 1. Schema Update (`firestore.schema.js`)
- Added `allTimeDrinkVariations` field to USER_SCHEMA documentation
- Clearly marked as "never resets" to distinguish from per-run `drinkVariations`

### 2. User Service Updates (`userService.js`)

#### `createUser` function:
- Initialize `allTimeDrinkVariations: {}` for new users

#### `addDrink` function:
- Now increments both `drinkVariations` (current run) AND `allTimeDrinkVariations` (lifetime)
- Uses same nested path logic with proper initialization
- Ensures atomic updates with Firestore increment

#### `removeDrink` function:
- Decrements both `drinkVariations` AND `allTimeDrinkVariations`
- Includes safety check to prevent negative values

### 3. UI Update (`ProfileDetails.jsx`)

#### `allTimeVariations` computation:
- **Before**: Faked data from `drinkTypes` → `{ Beer: { Beer: 10 } }`
- **After**: Uses real `allTimeDrinkVariations` → `{ beer: { Lager: 50, IPA: 30 } }`

## How It Works Now

### Current Run View:
- Uses `drinkVariations` (resets daily at 10:00)
- Shows drinks logged in the current run
- Percentages calculated against `currentRunDrinkCount`

### All-Time View:
- Uses `allTimeDrinkVariations` (never resets)
- Shows all drinks logged across user's lifetime
- Percentages calculated against `totalDrinks`
- Each variation's percentage = (variation count / total drinks) × 100

## Data Migration

**Note**: Existing users will have `allTimeDrinkVariations: {}` initially because:
1. New users get it initialized in `createUser`
2. Existing users will start accumulating data as they log new drinks
3. The field will be created automatically when they log their first drink after this update

If you want to backfill existing users' data, you would need to run a migration script that:
- Reads each user's `drinkTypes` and historical data
- Populates `allTimeDrinkVariations` based on available data
- However, this may not be necessary if the app is new or has limited users

## Verification

To verify the fix works:

1. **Log some drinks** with different variations (e.g., 3 Lagers, 2 IPAs, 1 Mojito)
2. **Check ProfileDetails** and switch to "All-time" view
3. **Verify**:
   - Individual variations are shown (not just categories)
   - Percentages add up to ~100%
   - Percentages are calculated against total drinks
   - Data persists across app reloads and run resets

## Example

If a user has logged:
- 50 Lagers
- 30 IPAs  
- 20 Mojitos
- Total: 100 drinks

The All-time view should show:
- Lager: 50% (50 drinks)
- IPA: 30% (30 drinks)
- Mojito: 20% (20 drinks)
