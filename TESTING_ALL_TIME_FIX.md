# Testing the All-Time Percentage Fix

## Quick Test Steps

### 1. Test with New Drinks
1. Open the app and log some drinks with different variations:
   - Log 3 Lagers (beer)
   - Log 2 IPAs (beer)
   - Log 1 Mojito (cocktail)
   
2. Navigate to your profile (ProfileDetails)

3. Switch to "All-time" view using the toggle

4. **Expected Results**:
   - You should see individual variations: "Lager", "IPA", "Mojito"
   - Percentages should be:
     - Lager: 50% (3 out of 6 total)
     - IPA: 33% (2 out of 6 total)
     - Mojito: 17% (1 out of 6 total)
   - Percentages should add up to ~100%

### 2. Test Persistence
1. Reset your current run (if available)
2. Check the "All-time" view again
3. **Expected**: All-time data should remain unchanged

### 3. Test Current Run vs All-Time
1. Log 2 more Lagers in the new run
2. Switch between "Current run" and "All-time" views
3. **Expected**:
   - Current run: Shows only the 2 new Lagers (100%)
   - All-time: Shows all 5 Lagers + 2 IPAs + 1 Mojito

### 4. Verify Percentage Calculation
The formula used is:
```
percentage = (variation count / total drinks) × 100
```

For all-time view:
- **Numerator**: Count from `allTimeDrinkVariations[type][variation]`
- **Denominator**: `totalDrinks` (user's lifetime total)

## What to Look For

### ✅ Correct Behavior:
- Individual variations shown (not just category names)
- Percentages calculated against total drinks
- Data persists across run resets
- Percentages add up to ~100%

### ❌ Bug Indicators:
- Only category names shown (e.g., "Beer", "Cocktail")
- Percentages don't add up to 100%
- All-time data resets when you reset current run
- Missing variations that were logged

## For Existing Users

**Note**: If you're testing with an existing user account that has historical drinks:

1. The `allTimeDrinkVariations` field will be empty initially
2. It will start accumulating data as you log new drinks
3. Historical drinks won't be included unless you run a migration

To test with existing data, either:
- Create a new test user account, OR
- Manually add the field to your user document in Firestore with sample data

## Console Verification

You can also check the data in the browser console:

```javascript
// In the ProfileDetails component, check the profile data
console.log('All-time variations:', profile?.allTimeDrinkVariations);
console.log('Total drinks:', profile?.totalDrinks);
console.log('Current run variations:', profile?.drinkVariations);
```

Expected structure:
```javascript
{
  allTimeDrinkVariations: {
    beer: { Lager: 50, IPA: 30 },
    cocktail: { Mojito: 20 }
  },
  totalDrinks: 100
}
```
