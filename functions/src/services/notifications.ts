import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { sendEmail } from "./email";

const meterInFeet = 3.2808399;
const cubicMeterInFeet = Math.pow(meterInFeet, 3);

function addFlowDataToFavorites(favorites: any, gauges: any = {}) {
	for (const gaugeID in favorites) {
		const rivers = favorites[gaugeID];
		const gaugeRecord = gauges[gaugeID] || gauges["USGS:" + gaugeID] || gauges["canada:" + gaugeID];
		const readings = gaugeRecord?.readings || [];

		let latestReading: any = {};
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

			latestReading.meters = latestReading?.feet / meterInFeet;
			latestReading.cms = latestReading?.cfs / cubicMeterInFeet;

			if (river.units === "cms" || river.units === "meters") {
				if (latestReading?.meters !== undefined && !isNaN(latestReading.meters)) {
					river.flowInfo = `${Math.round(latestReading.meters * 100) / 100} meters`;
				}
				if (latestReading?.cms !== undefined && !isNaN(latestReading.cms)) {
					if (latestReading?.meters) {
						river.flowInfo += ", ";
					}
					else {
						river.flowInfo = "";
					}
					river.flowInfo += `${Math.round(latestReading.cms * 100) / 100} cms`;
				}
			}
			else {
				if (latestReading?.feet !== undefined && !isNaN(latestReading.feet)) {
					river.flowInfo = `${Math.round(latestReading.feet * 100) / 100} feet`;
				}
				if (latestReading?.cfs !== undefined && !isNaN(latestReading.cfs)) {
					if (latestReading?.feet) {
						river.flowInfo += ", ";
					}
					else {
						river.flowInfo = "";
					}
					river.flowInfo += `${Math.round(latestReading.cfs)} cfs`;
				}
			}

			river.latestReading = latestReading?.[units];

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

export async function processNotifications(flowDataGlob: any) {
    const db = getFirestore();
    const auth = getAuth();

	const usersToExamine = await db.collection("users")
		.where("notifications.enabled", "==", true) // Only where notifications enabled.
		.where("notifications.noneUntil", "<=", Date.now()) // Only where noneUntil doesn't disable
		.get();

	const usersMap = new Map<string, any>();

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
        if (userIDChunk.length === 0) continue;

        try {
            const result = await auth.getUsers(userIDChunk);

            // Delete user alerts if they no longer have auth accounts
            result.notFound.forEach((user: any) => {
                const userData = usersMap.get(user.uid);
                if (userData) {
                    userData.document.ref.delete();
                    usersMap.delete(user.uid);
                }
            });

            // Map auth struct to the object payload strictly
            result.users.forEach((user) => {
                const d = usersMap.get(user.uid);
                if (d) d.auth = user;
            });
        } catch (e: any) {
            console.error("Non-fatal: Auth batch lookup failed, skipping users chunk.", e.message);
        }
    }

	const userData = Array.from(usersMap.values());
    console.log(`Evaluating alerts for ${userData.length} active users.`);

	for (let i = 0; i < userData.length; i++) {
		const user = userData[i];

		if (user.notifications?.noneUntil > Date.now()) { continue; }
		if (!user.notifications?.enabled) { continue; }

        // Mute Beta/Dev environments purely natively specifically for non-Admins!
        const isBeta = process.env.GCLOUD_PROJECT !== "rivers-run";
        if (isBeta && !user.isAdmin) { continue; }

		addFlowDataToFavorites(user.favorites, flowDataGlob);

		try {
		    await sendEmail(user);
        } catch (e: any) {
            console.error(`Non-fatal: Failed to process email alerts for ${user.auth?.email || "Unknown"}`, e.message);
        }
	}
}
