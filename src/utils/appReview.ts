import { InAppReview } from '@capacitor-community/in-app-review';
import { persistentStorage } from './persistentStorage';

const REVIEW_DATES_KEY = "app_review_active_dates";
const HAS_REQUESTED_REVIEW_KEY = "app_review_has_requested";
const REQUIRED_DAYS = 10;

/**
 * Records an app open for today. Returns true if a new day was added.
 */
export async function recordAppOpen(): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Have we already requested a review?
    const hasRequested = await persistentStorage.get(HAS_REQUESTED_REVIEW_KEY);
    if (hasRequested === "true") return;

    // Load active dates
    const datesStr = await persistentStorage.get(REVIEW_DATES_KEY);
    const activeDates: string[] = datesStr ? JSON.parse(datesStr) : [];

    if (!activeDates.includes(today)) {
      activeDates.push(today);
      await persistentStorage.set(REVIEW_DATES_KEY, JSON.stringify(activeDates));
    }
  } catch (error) {
    console.error("Failed to record app open for review purposes", error);
  }
}

/**
 * Checks if the user is eligible for a review (has opened the app on enough distinct days)
 * and triggers the native prompt if so.
 */
export async function triggerReviewIfEligible(): Promise<void> {
  try {
    const hasRequested = await persistentStorage.get(HAS_REQUESTED_REVIEW_KEY);
    if (hasRequested === "true") return;

    const datesStr = await persistentStorage.get(REVIEW_DATES_KEY);
    const activeDates: string[] = datesStr ? JSON.parse(datesStr) : [];

    if (activeDates.length >= REQUIRED_DAYS) {
      // Mark as requested before we call it, to prevent double-firing
      await persistentStorage.set(HAS_REQUESTED_REVIEW_KEY, "true");
      
      // Call the native review prompt
      await InAppReview.requestReview();
    }
  } catch (error) {
    console.error("Failed to trigger app review", error);
    // If it failed, we might want to let it try again later, but usually it fails 
    // because of dev environment or platform mismatch, so we keep the flag true 
    // to avoid spamming the console on web.
  }
}
