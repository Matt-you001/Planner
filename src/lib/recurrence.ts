import type { CustomRepeatConfig, RepeatFrequency } from './types';
import { addDays, addWeeks, addMonths, addYears, isBefore, isSameDay } from 'date-fns';

export function generateRecurringDates(
    startDate: Date,
    frequency: RepeatFrequency,
    customConfig?: CustomRepeatConfig,
    limitDate?: Date
): Date[] {
    const dates: Date[] = [];
    const start = new Date(startDate);
    
    // Default limit: 90 days if not specified and not controlled by occurrences
    const defaultLimit = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000); 
    const effectiveLimitDate = limitDate || defaultLimit;

    // Helper to check limit
    const isWithinLimit = (d: Date) => {
        // If custom config has specific end date, that takes precedence over the "limitDate" 
        // passed in (which is usually the Goal Target Date or 90 days).
        // BUT, we should probably respect the Goal Target Date as a hard stop if it exists.
        // For now, let's just use the passed limitDate as the bounds.
        return isBefore(d, effectiveLimitDate) || isSameDay(d, effectiveLimitDate);
    };

    if (frequency === 'Never') {
        dates.push(start);
        return dates;
    }

    if (frequency !== 'Custom') {
        let current = new Date(start);
        let count = 0;
        const MAX_INSTANCES = 365; // Safety break

        while (isWithinLimit(current) && count < MAX_INSTANCES) {
            dates.push(new Date(current));
            
            if (frequency === 'Daily') current = addDays(current, 1);
            else if (frequency === 'Weekly') current = addWeeks(current, 1);
            else if (frequency === 'Monthly') current = addMonths(current, 1);
            else if (frequency === 'Yearly') current = addYears(current, 1);
            
            count++;
        }
        return dates;
    }

    // Custom Logic
    if (!customConfig) {
        // Fallback if custom selected but no config
        dates.push(start);
        return dates;
    }

    let current = new Date(start);
    let count = 0;
    const MAX_INSTANCES = 365;

    // Determine stop condition
    const shouldStop = (d: Date, c: number) => {
        if (c >= MAX_INSTANCES) return true;
        
        if (customConfig.endOption === 'AfterOccurrences') {
            return c >= (customConfig.occurrences || 1);
        }
        
        if (customConfig.endOption === 'OnDate' && customConfig.endDate) {
            const end = new Date(customConfig.endDate);
            // Include end date
            return d > end; // Stop if current > end
        }
        
        // 'Never' (defaults to effectiveLimitDate)
        return !isWithinLimit(d);
    };

    while (!shouldStop(current, count)) {
        // Check if day matches for Weekly with specific days
        let matchesDay = true;
        if (customConfig.unit === 'Week' && customConfig.weekDays && customConfig.weekDays.length > 0) {
            const dayIndex = current.getDay(); // 0-6
            matchesDay = customConfig.weekDays.includes(dayIndex);
        }

        if (matchesDay) {
            dates.push(new Date(current));
            count++; // Only increment count if we actually added a date (important for 'occurrences')
            
            // If we are doing 'AfterOccurrences', we need to break immediately if we hit the count
            if (customConfig.endOption === 'AfterOccurrences' && count >= (customConfig.occurrences || 1)) {
                break;
            }
        }

        // Advance
        // For Weekly with specific days, we still step by the frequency, 
        // BUT standard recurrence rules (like Google Calendar) usually mean:
        // "Every 2 weeks on Mon, Wed" means: 
        // Week 1: Mon, Wed
        // Week 3: Mon, Wed
        // It does NOT mean check every day.
        
        // HOWEVER, a simpler implementation for "Specific Days" is often:
        // Iterate days, check if matches.
        // But if frequency > 1, it gets complex.
        
        // Let's stick to a simpler interpretation:
        // If Unit is 'Day', add frequency * days.
        // If Unit is 'Month', add frequency * months.
        // If Unit is 'Year', add frequency * years.
        
        // If Unit is 'Week':
        // If no specific days selected, add frequency * weeks.
        // If specific days selected:
        // This is tricky. 
        // Strategy: 
        // 1. Find the start of the current week.
        // 2. Iterate through the selected days of that week.
        // 3. Add those dates if they are >= start date.
        // 4. Jump 'frequency' weeks.
        
        if (customConfig.unit === 'Week' && customConfig.weekDays && customConfig.weekDays.length > 0) {
             // This logic is hard to fit in a simple while loop.
             // Let's restart the loop logic for this specific case.
             // Actually, let's simplify.
             // If we are here, we might have added 'current' if matchesDay was true.
             // But if we just increment by 1 day, we might handle it?
             // No, because "Every 2 weeks" means we skip weeks.
        }
    }
    
    // RE-IMPLEMENTATION for robust custom handling
    // Reset dates
    const finalDates: Date[] = [];
    let iterDate = new Date(start);
    let occurrencesFound = 0;
    
    // Safety
    const SAFE_LIMIT = 365;

    if (customConfig.unit === 'Week' && customConfig.weekDays && customConfig.weekDays.length > 0) {
        // Special handling for "Every X weeks on [Days]"
        // Align iterDate to the start of the week (Sunday)
        // Then iterate weeks by frequency
        
        // Actually, we should start from the week containing start date.
        // Find Sunday of that week
        const day = iterDate.getDay();
        const diff = iterDate.getDate() - day; 
        let weekStart = new Date(iterDate);
        weekStart.setDate(diff); // This is the Sunday of the start week.

        while (occurrencesFound < SAFE_LIMIT) {
             // For this week, check all selected days
             const weekDates: Date[] = [];
             for (const dayIdx of customConfig.weekDays) {
                 const d = new Date(weekStart);
                 d.setDate(weekStart.getDate() + dayIdx);
                 
                 // Must be >= original start date
                 if (d >= start) {
                     weekDates.push(d);
                 }
             }
             
             // Sort week dates
             weekDates.sort((a,b) => a.getTime() - b.getTime());

             for (const d of weekDates) {
                 if (shouldStop(d, occurrencesFound)) return finalDates;
                 finalDates.push(d);
                 occurrencesFound++;
             }

             // Jump by frequency
             weekStart = addWeeks(weekStart, customConfig.frequency);
             
             // Check if entire week is out of bounds (optimization)
             if (customConfig.endOption === 'OnDate' && customConfig.endDate) {
                 if (weekStart > new Date(customConfig.endDate)) break;
             } else if (customConfig.endOption === 'Never') {
                 if (!isWithinLimit(weekStart)) break;
             }
        }
    } else {
        // Standard Day/Week/Month/Year without sub-days
        let ptr = new Date(start);
        while (occurrencesFound < SAFE_LIMIT) {
            if (shouldStop(ptr, occurrencesFound)) break;
            
            finalDates.push(new Date(ptr));
            occurrencesFound++;
            
            if (customConfig.unit === 'Day') ptr = addDays(ptr, customConfig.frequency);
            else if (customConfig.unit === 'Week') ptr = addWeeks(ptr, customConfig.frequency);
            else if (customConfig.unit === 'Month') ptr = addMonths(ptr, customConfig.frequency);
            else if (customConfig.unit === 'Year') ptr = addYears(ptr, customConfig.frequency);
        }
    }

    return finalDates;
}
