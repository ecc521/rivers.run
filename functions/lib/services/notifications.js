"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processNotifications = processNotifications;
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const email_1 = require("./email");
const meterInFeet = 3.2808399;
const cubicMeterInFeet = Math.pow(meterInFeet, 3);
function addFlowDataToFavorites(favorites, gauges = {}) {
    for (const gaugeID in favorites) {
        const rivers = favorites[gaugeID];
        const gaugeRecord = gauges[gaugeID] || gauges["USGS:" + gaugeID] || gauges["canada:" + gaugeID];
        const readings = (gaugeRecord === null || gaugeRecord === void 0 ? void 0 : gaugeRecord.readings) || [];
        let latestReading = {};
        for (let i = readings.length - 1; i >= 0; i--) {
            // Find the latest non-forecast flow value.
            if (readings[i].forecast !== true) {
                latestReading = readings[i];
                break;
            }
        }
        for (const riverID in rivers) {
            const river = rivers[riverID];
            const units = river.units;
            river.flowInfo = "No Flow Data";
            latestReading.meters = (latestReading === null || latestReading === void 0 ? void 0 : latestReading.feet) / meterInFeet;
            latestReading.cms = (latestReading === null || latestReading === void 0 ? void 0 : latestReading.cfs) / cubicMeterInFeet;
            if (river.units === "cms" || river.units === "meters") {
                if ((latestReading === null || latestReading === void 0 ? void 0 : latestReading.meters) !== undefined && !isNaN(latestReading.meters)) {
                    river.flowInfo = `${Math.round(latestReading.meters * 100) / 100} meters`;
                }
                if ((latestReading === null || latestReading === void 0 ? void 0 : latestReading.cms) !== undefined && !isNaN(latestReading.cms)) {
                    if (latestReading === null || latestReading === void 0 ? void 0 : latestReading.meters) {
                        river.flowInfo += ", ";
                    }
                    else {
                        river.flowInfo = "";
                    }
                    river.flowInfo += `${Math.round(latestReading.cms * 100) / 100} cms`;
                }
            }
            else {
                if ((latestReading === null || latestReading === void 0 ? void 0 : latestReading.feet) !== undefined && !isNaN(latestReading.feet)) {
                    river.flowInfo = `${Math.round(latestReading.feet * 100) / 100} feet`;
                }
                if ((latestReading === null || latestReading === void 0 ? void 0 : latestReading.cfs) !== undefined && !isNaN(latestReading.cfs)) {
                    if (latestReading === null || latestReading === void 0 ? void 0 : latestReading.feet) {
                        river.flowInfo += ", ";
                    }
                    else {
                        river.flowInfo = "";
                    }
                    river.flowInfo += `${Math.round(latestReading.cfs)} cfs`;
                }
            }
            river.latestReading = latestReading === null || latestReading === void 0 ? void 0 : latestReading[units];
            let status;
            if (river.latestReading > river.maximum) {
                status = "high";
            }
            else if (river.latestReading < river.minimum) {
                status = "low";
            }
            else if ((river.minimum === undefined && river.maximum === undefined) || river.latestReading === undefined) {
                status = "unknown";
            }
            else {
                status = "running";
            }
            river.status = status;
        }
    }
}
async function processNotifications(flowDataGlob) {
    var _a, _b, _c;
    const db = (0, firestore_1.getFirestore)();
    const auth = (0, auth_1.getAuth)();
    const usersToExamine = await db.collection("users")
        .where("notifications.enabled", "==", true) // Only where notifications enabled.
        .where("notifications.noneUntil", "<=", Date.now()) // Only where noneUntil doesn't disable
        .get();
    const usersMap = new Map();
    usersToExamine.forEach((queryDocumentSnapshot) => {
        const data = queryDocumentSnapshot.data();
        const uid = queryDocumentSnapshot.id;
        data.document = queryDocumentSnapshot; // Provide a reference to the original document so this record can be amended.
        usersMap.set(uid, data);
    });
    const userIDs = Array.from(usersMap.keys()).map((userID) => ({ uid: userID }));
    // Batch lookup emails natively via Auth
    const increment = 100;
    for (let i = 0; i < userIDs.length; i += increment) {
        const userIDChunk = userIDs.slice(i, i + increment);
        if (userIDChunk.length === 0)
            continue;
        try {
            const result = await auth.getUsers(userIDChunk);
            // Delete user alerts if they no longer have auth accounts
            result.notFound.forEach((user) => {
                const userData = usersMap.get(user.uid);
                if (userData) {
                    userData.document.ref.delete();
                    usersMap.delete(user.uid);
                }
            });
            // Map auth struct to the object payload strictly
            result.users.forEach((user) => {
                const d = usersMap.get(user.uid);
                if (d)
                    d.auth = user;
            });
        }
        catch (e) {
            console.error("Non-fatal: Auth batch lookup failed, skipping users chunk.", e.message);
        }
    }
    const userData = Array.from(usersMap.values());
    console.log(`Evaluating alerts for ${userData.length} active users.`);
    for (let i = 0; i < userData.length; i++) {
        const user = userData[i];
        if (((_a = user.notifications) === null || _a === void 0 ? void 0 : _a.noneUntil) > Date.now()) {
            continue;
        }
        if (!((_b = user.notifications) === null || _b === void 0 ? void 0 : _b.enabled)) {
            continue;
        }
        // Mute Beta/Dev environments purely natively specifically for non-Admins!
        const isBeta = process.env.GCLOUD_PROJECT !== "rivers-run";
        if (isBeta && !user.isAdmin) {
            continue;
        }
        addFlowDataToFavorites(user.favorites, flowDataGlob);
        try {
            await (0, email_1.sendEmail)(user);
        }
        catch (e) {
            console.error(`Non-fatal: Failed to process email alerts for ${((_c = user.auth) === null || _c === void 0 ? void 0 : _c.email) || "Unknown"}`, e.message);
        }
    }
}
//# sourceMappingURL=notifications.js.map