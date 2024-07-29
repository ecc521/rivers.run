//Enable analytics.
import { FirebaseAnalytics } from "@capacitor-firebase/analytics";

function enableAnalytics() {
  FirebaseAnalytics.setEnabled({
    enabled: true,
  });
}

export {enableAnalytics};