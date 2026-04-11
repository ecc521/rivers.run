import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { sendEmail } from "./email";
import { syncAlertDataToStorage } from "./alertdata";

const meterInFeet = 3.2808399;
const cubicMeterInFeet = Math.pow(meterInFeet, 3);

function formatFlowInfo(river: any, latestReading: any) {
	river.flowInfo = "No Flow Data";
	if (river.units === "cms" || river.units === "meters") {
		if (latestReading?.meters !== undefined && !isNaN(latestReading.meters)) {
			river.flowInfo = `${Math.round(latestReading.meters * 100) / 100} meters`;
		}
		if (latestReading?.cms !== undefined && !isNaN(latestReading.cms)) {
			river.flowInfo = latestReading?.meters ? `${river.flowInfo}, ` : "";
			river.flowInfo += `${Math.round(latestReading.cms * 100) / 100} cms`;
		}
	} else {
		if (latestReading?.feet !== undefined && !isNaN(latestReading.feet)) {
			river.flowInfo = `${Math.round(latestReading.feet * 100) / 100} feet`;
		}
		if (latestReading?.cfs !== undefined && !isNaN(latestReading.cfs)) {
			river.flowInfo = latestReading?.feet ? `${river.flowInfo}, ` : "";
			river.flowInfo += `${Math.round(latestReading.cfs)} cfs`;
		}
	}
}

function calculateRiverStatus(river: any, latestReading: any, units: string) {
	river.latestReading = latestReading?.[units];
	if (river.latestReading > river.maximum) return "high";
	if (river.latestReading < river.minimum) return "low";
	if ((river.minimum === undefined && river.maximum === undefined) || river.latestReading === undefined) return "unknown";
	return "running";
}

function getLatestReading(readings: any[]) {
    for (let i = readings.length - 1; i >= 0; i--) {
        if (readings[i].forecast !== true) return readings[i];
    }
    return {};
}

function addFlowDataToFavorites(favorites: any[], gauges: any = {}) {
    if (!Array.isArray(favorites)) return;

    for (const fav of favorites) {
        if (!fav.gauge || fav.gauge === "none") {
            fav.status = "unknown";
            fav.flowInfo = "No Flow Data";
            continue;
        }

        const gaugeID = fav.gauge;
		const gaugeRecord = gauges[gaugeID] || gauges["USGS:" + gaugeID] || gauges["canada:" + gaugeID];
		const readings = gaugeRecord?.readings || [];

		const latestReading = getLatestReading(readings);
        latestReading.meters = latestReading?.feet / meterInFeet;
        latestReading.cms = latestReading?.cfs / cubicMeterInFeet;

        formatFlowInfo(fav, latestReading);
		fav.status = calculateRiverStatus(fav, latestReading, fav.units);
    }
}

export async function processNotifications(flowDataGlob: any) {
    const db = getFirestore();
    const bucket = getStorage().bucket();
    const auth = getAuth();

	const synchronizedUsers = await syncAlertDataToStorage(db, bucket);

	const usersMap = new Map<string, any>();

	synchronizedUsers.forEach((data) => {
		const uid = data.uid;
		usersMap.set(uid, data);
	});

	const userIDs = Array.from(usersMap.keys()).map((userID) => ({ uid: userID }));
    
    // Batch lookup emails natively via Auth
    const increment = 100;
    for (let i = 0; i < userIDs.length; i += increment) {
        const userIDChunk = userIDs.slice(i, i + increment);
        if (userIDChunk.length === 0) continue;

        try {
            const result = await auth.getUsers(userIDChunk);

            // Delete user alerts if they no longer have auth accounts
            result.notFound.forEach((user: any) => {
                const userData = usersMap.get(user.uid);
                if (userData) {
                    db.collection("user").doc(user.uid).delete(); // Native cleanup
                    usersMap.delete(user.uid);
                }
            });

            // Map auth struct to the object payload strictly
            result.users.forEach((user) => {
                const d = usersMap.get(user.uid);
                if (d) d.auth = user;
            });
        } catch (e: unknown) {
            console.error("Non-fatal: Auth batch lookup failed, skipping users chunk.", e instanceof Error ? e.message : e);
        }
    }

	const userData = Array.from(usersMap.values());
    console.log(`Evaluating alerts for ${userData.length} active users.`);

	const activeUsers = userData.filter((user) => {
		if (user.notifications?.noneUntil > Date.now()) { return false; }
		if (!user.notifications?.enabled) { return false; }

        // Mute Beta/Dev environments purely natively specifically for non-Admins!
        const isBeta = process.env.GCLOUD_PROJECT !== "rivers-run";
        if (isBeta && !user.isAdmin) { return false; }
        return true;
    });

    const CONCURRENCY_LIMIT = 20;
    let userIndex = 0;
    const writeResults: { user: any, notifications: any }[] = [];

    const worker = async () => {
        while (userIndex < activeUsers.length) {
            const user = activeUsers[userIndex++];
            addFlowDataToFavorites(user.favorites, flowDataGlob);
            
            try {
                const result = await sendEmail(user);
                if (result?.notifications) {
                    writeResults.push({ user, notifications: result.notifications });
                }
            } catch (e: unknown) {
                console.error(`Non-fatal: Failed to process email alerts for ${user.auth?.email || "Unknown"}`, e instanceof Error ? e.message : e);
            }
        }
    };

    await Promise.all(Array(Math.min(CONCURRENCY_LIMIT, activeUsers.length)).fill(0).map(() => worker()));

    // Securely batch database commits inside maximum Firestore transaction size block constraint
    const FIRESTORE_BATCH_MAX = 400;
    for (let i = 0; i < writeResults.length; i += FIRESTORE_BATCH_MAX) {
        const chunk = writeResults.slice(i, i + FIRESTORE_BATCH_MAX);
        const fbBatch = db.batch();

        for (const res of chunk) {
            fbBatch.set(db.collection("user").doc(res.user.uid), { notifications: res.notifications }, { merge: true });
        }

        try {
            await fbBatch.commit();
        } catch (e: unknown) {
            console.error("Non-fatal: Bulk save of user notifications failed.", e instanceof Error ? e.message : e);
        }
    }
}
