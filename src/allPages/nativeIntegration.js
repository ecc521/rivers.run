import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { FirebaseAnalytics } from "@capacitor-firebase/analytics";
import { App } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update';

// Check for updates
async function createPopupIfUpdate() {
    try {
        if (!Capacitor.isNativePlatform()) return;

        let appUpdateInfo = await AppUpdate.getAppUpdateInfo();
        if (appUpdateInfo.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) {
            return;
        }

        let popup = document.createElement("div")
        popup.innerHTML = `
                        <h1>App Update</h1>
                        <h2>There is a Rivers.run app update. Downloading it is recommended. You may experience issues if you do not update.</h2>`
        popup.style.left = popup.style.top = popup.style.bottom = popup.style.right = "0"
        popup.style.position = "absolute"
        popup.style.textAlign = "center"
        popup.style.backgroundColor = "white"
        popup.style.color = "black"
        popup.style.padding = "10px"
        popup.style.paddingTop = "30px"
        popup.style.zIndex = "9999999" // Ensure it's on top

        let beginUpdateButton = document.createElement("button")
        beginUpdateButton.innerHTML = "Update Now"
        beginUpdateButton.style.padding = "20px"
        beginUpdateButton.style.fontSize = "2em"
        beginUpdateButton.addEventListener("click", function() {
            AppUpdate.openAppStore()
        })
        popup.append(beginUpdateButton)

        let closeButton = document.createElement("button")
        closeButton.innerHTML = "Close"
        closeButton.style.padding = "20px"
        closeButton.style.fontSize = "2em"
        closeButton.addEventListener("click", function() {
            popup.remove()
        })

        popup.appendChild(closeButton)
        document.body.appendChild(popup)
    } catch (e) {
        console.error("Error checking for updates", e);
    }
}

// Universal Links / Deep Links
function setupUniversalLinks() {
    App.addListener('appUrlOpen', (data) => {
        console.log('App opened with URL: ' + data.url);
        try {
            const url = new URL(data.url);
            // Handle navigation based on URL
            // If it's a known path, navigate.

            // If the path ends in .html, we might want to reload or navigate.
            // If it's the same page, just hash change.
            if (url.pathname && url.pathname !== "/" && url.pathname !== "/index.html") {
                 window.location.href = url.pathname + url.search + url.hash;
            } else if (url.hash) {
                 window.location.hash = url.hash;
            }
        } catch (e) {
            console.error("Error processing deep link", e);
        }
    });
}

// Initialize native features
if (Capacitor.isNativePlatform()) {
    createPopupIfUpdate();
    setupUniversalLinks();
    try {
        FirebaseAnalytics.setEnabled({
            enabled: true,
        });
    } catch (e) {
        console.error("Error enabling analytics", e);
    }
    try {
        Keyboard.setAccessoryBarVisible({isVisible: true});
    } catch (e) {
        console.error("Error setting keyboard accessory bar", e);
    }
}


// Exported functions for global use
window.nativeLocationRequest = async function nativeLocationRequest() {
    try {
        const position = await Geolocation.getCurrentPosition();
        return position;
    } catch (e) {
        throw e;
    }
}

window.signOut = async function signOut() {
    return await FirebaseAuthentication.signOut();
}

window.signInWithProvider = async function signInWithProvider(provider, config) {
    if (provider === "google") {
        return await FirebaseAuthentication.signInWithGoogle(config);
    }
    else if (provider === "apple") {
        return await FirebaseAuthentication.signInWithApple(config);
    }
    else if (provider === "facebook") {
        return await FirebaseAuthentication.signInWithFacebook(config);
    }
    else {
        throw "Unknown Provider: " + provider;
    }
}
