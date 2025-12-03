
const RESET_BOUNDARY_HOUR = 12;
const RESET_TIMEZONE = 'Europe/Copenhagen';
const DRINK_DAY_START_HOUR = 10;

const TIMEZONE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    timeZone: RESET_TIMEZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
});

function normalizeToDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    // Mock Firestore Timestamp .toDate()
    if (typeof value.toDate === 'function') {
        return value.toDate();
    }
    if (typeof value.seconds === 'number') {
        return new Date(value.seconds * 1000);
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getTimeZoneOffsetMs(date) {
    const parts = TIMEZONE_FORMATTER.formatToParts(date);
    const extracted = {};
    parts.forEach(part => {
        if (part.type !== 'literal') {
            extracted[part.type] = part.value;
        }
    });
    const zonedUtc = Date.UTC(
        Number(extracted.year),
        Number(extracted.month) - 1,
        Number(extracted.day),
        Number(extracted.hour),
        Number(extracted.minute),
        Number(extracted.second)
    );
    return zonedUtc - date.getTime();
}

function shiftDateByOffset(date, offsetMs) {
    return new Date(date.getTime() + offsetMs);
}

function getLatestResetBoundary(now = new Date()) {
    const offsetMs = getTimeZoneOffsetMs(now);
    const zoned = shiftDateByOffset(now, offsetMs);
    const boundary = new Date(zoned);
    const zonedHour = boundary.getUTCHours();
    boundary.setUTCHours(RESET_BOUNDARY_HOUR, 0, 0, 0);
    if (zonedHour < RESET_BOUNDARY_HOUR) {
        boundary.setUTCDate(boundary.getUTCDate() - 1);
    }
    return shiftDateByOffset(boundary, -offsetMs);
}

function getNextResetBoundary(now = new Date()) {
    const offsetMs = getTimeZoneOffsetMs(now);
    const zoned = shiftDateByOffset(now, offsetMs);
    const boundary = new Date(zoned);
    const zonedHour = boundary.getUTCHours();
    boundary.setUTCHours(RESET_BOUNDARY_HOUR, 0, 0, 0);
    if (zonedHour >= RESET_BOUNDARY_HOUR) {
        boundary.setUTCDate(boundary.getUTCDate() + 1);
    }
    return shiftDateByOffset(boundary, -offsetMs);
}

function getSladeshCooldownState(userData = {}, now = new Date()) {
    const lastSentAt = normalizeToDate(userData.lastSladeshSentAt);
    const blockStart = getLatestResetBoundary(now);
    const blockEnd = getNextResetBoundary(now);
    const blocked =
        !!lastSentAt &&
        lastSentAt.getTime() >= blockStart.getTime() &&
        lastSentAt.getTime() < blockEnd.getTime();

    return {
        blocked,
        canSend: !blocked,
        lastSentAt,
        blockStartedAt: blockStart,
        blockEndsAt: blockEnd
    };
}

// Test cases
const now = new Date("2025-12-03T11:14:12+01:00"); // Current time from metadata
console.log("Current Time:", now.toString());

const testCases = [
    { name: "Empty User Data", userData: {} },
    { name: "Null lastSladeshSentAt", userData: { lastSladeshSentAt: null } },
    { name: "Undefined lastSladeshSentAt", userData: { lastSladeshSentAt: undefined } },
    { name: "Recent Sladesh (10am today)", userData: { lastSladeshSentAt: new Date("2025-12-03T10:00:00+01:00") } }, // Should be blocked (Yesterday 12pm - Today 12pm block)
    { name: "Old Sladesh (Yesterday 11am)", userData: { lastSladeshSentAt: new Date("2025-12-02T11:00:00+01:00") } }, // Should NOT be blocked (Previous block)
];

testCases.forEach(tc => {
    const result = getSladeshCooldownState(tc.userData, now);
    console.log(`Test Case: ${tc.name}`);
    console.log(`  Blocked: ${result.blocked}`);
    console.log(`  Block Start: ${result.blockStartedAt.toString()}`);
    console.log(`  Block End: ${result.blockEndsAt.toString()}`);
    console.log("---");
});
