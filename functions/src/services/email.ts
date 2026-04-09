import * as nodemailer from "nodemailer";

export function getSearchLink(IDs: string[], prefix = "https://rivers.run/") {
    // In legacy, the frontend supported hash arrays for search IDs natively 
    // We will just pass the first ID via search, or fallback to root.
    if (IDs.length === 1) {
        return `${prefix}?search=${encodeURIComponent(IDs[0])}`;
    }
    return prefix;
}

export function getNewNoneUntil(user: any) {
    if (!user.notifications) {
        return Date.now() + 1000 * 60 * 60 * 6; // 6 hours
    }
    
    // Legacy translation
    if (user.notifications.notifyEvery === "1 Hour") return Date.now() + 1000 * 60 * 60;
    if (user.notifications.notifyEvery === "6 Hours") return Date.now() + 1000 * 60 * 60 * 6;
    if (user.notifications.notifyEvery === "12 Hours") return Date.now() + 1000 * 60 * 60 * 12;
    if (user.notifications.notifyEvery === "1 Day") return Date.now() + 1000 * 60 * 60 * 24;
    if (user.notifications.notifyEvery === "2 Days") return Date.now() + 1000 * 60 * 60 * 48;
    if (user.notifications.notifyEvery === "1 Week") return Date.now() + 1000 * 60 * 60 * 24 * 7;
    
    return Date.now() + 1000 * 60 * 60 * 6;
}

const statuses = ["high", "running", "low", "unknown"];
const statusHeaders = ["Rivers that are Too High:", "Rivers that are Running:", "Rivers that are Too Low:", "Unclassified Rivers:"];

export function getMessage(user: any) {
    let title: string;
    let body = "";

	const statusMap = new Map<string, any[]>();
	statuses.forEach((prop) => {
		statusMap.set(prop, []);
	});

	const IDs: string[] = [];
	const favorites = user.favorites || {};
    
	for (const gaugeID in favorites) {
		const rivers = favorites[gaugeID];
		for (const riverID in rivers) {
			const river = rivers[riverID];
			IDs.push(riverID);
            const s = river.status || "unknown";
			statusMap.get(s)?.push(river);
		}
	}

	if (IDs.length === 0) { return false; } // User has no favorites. No reason to send an email.

	function getIDs(rivers: any[]) {
		return rivers.map((river) => river.id);
	}

	const running = statusMap.get("running") || [];

    if (running.length === 0) {
       	title = "Rivers are not running";
    }
    else if (running.length === 1) {
        title = (running[0].name.trim().endsWith("Creek")?"":"The ") + running[0].name + " is running!";
    }
    else if (running.length === 2) {
        title = "2 rivers are running!";
    }
    else {
        title = running.length + " rivers are running!";
    }

	body = `<html><head></head><body>`;

	const riversAboveTooLow = (statusMap.get("high")?.length || 0) + (statusMap.get("running")?.length || 0);

	if (riversAboveTooLow === 0) {
		body += `<p>Notifications are now suspended until at least one river is above minimum. </p>`;

		if (user?.notifications?.lastMessageData === 0) {
			// Don't message again.
			return false;
		}
	}

	function createListItem(river: any) {
		let str = "<li>" + `<a href="${getSearchLink([river.id])}">${river.name + (river.section?` (${river.section})`:"")}</a>`;
		str += `: ${river.flowInfo} `;
		if (!river.units) {
			str += " - No Units Selected";
		}
		else if (river.minimum === undefined && river.maximum === undefined) {
			str += " - No Min/Max Selected";
		}
		else {
			str += `(${river.minimum} ${river.units} - ${river.maximum} ${river.units})`;
		}
		str += "</li>";
		return str;
	}

	function createHeader(text: string) {
		return `<h2 style="margin-bottom: 0">${text}</h2>`;
	}

	statuses.forEach((status, i) => {
		const rivers = statusMap.get(status) || [];
		if (rivers.length === 0) { return; }

		body += createHeader(statusHeaders[i]);
		body += "<ul>";
		rivers.forEach((river) => {
			body += createListItem(river);
		});
		body += `<li style="font-size:0.9em;"><a href="${getSearchLink(getIDs(rivers))}">View all these on rivers.run</a></li>`;
		body += "</ul>";
	});

	body += `<p><a href="${getSearchLink(IDs)}">View All Favorites on rivers.run</a></p>`;
    body += `<h1 style="margin-bottom:0.5em"><img src="https://rivers.run/resources/icons/64x64-Water-Drop.png" style="vertical-align: text-top; height:1em; width: 1em;"><a href="https://rivers.run" style="color:black">rivers.run</a></h1>`;
	body += "<p><a href='mailto:support@rivers.run'>support@rivers.run</a></p>";
	body += `<p>Click <a href="https://rivers.run/favorites">here</a> to manage your subscription, or to unsubscribe.</p>`;
	body += "</body></html>";

	return {
		subject: title,
		body: body,
		lastMessageData: riversAboveTooLow
	};
}

export async function sendEmail(user: any) {
    const password = process.env.GMAIL_PASSWORD;
    if (!password) {
        console.warn("Emails bypassed: GMAIL_PASSWORD environment natively undefined.");
        return;
    }

	const transporter = nodemailer.createTransport({
		service: 'gmail',
		secure: true,
		auth: {
			user: 'email.rivers.run@gmail.com',
			pass: password
		}
	});

	const mailInfo = getMessage(user);

	const notifications = {
		noneUntil: getNewNoneUntil(user),
        lastMessageData: undefined as number | undefined
	};

	if (mailInfo && mailInfo.lastMessageData !== undefined) {
		notifications.lastMessageData = mailInfo.lastMessageData;
	}

	// Write the value to firebase internally to update the noneUntil constraint
	await user.document.ref.set({notifications}, {merge: true});

	if (mailInfo === false) { return; } 

	const mailOptions = {
	  from: 'email.rivers.run@gmail.com',
	  to: user.auth.email,
	  subject: mailInfo.subject,
	  html: mailInfo.body
	};

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log("Notified user:", user.auth.email, info.messageId);
        return info;
    } catch (e) {
        console.error("Failed sending email:", e);
        return false;
    }
}
