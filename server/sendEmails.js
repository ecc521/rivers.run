const fs = require("fs")
const path = require("path")
const nodemailer = require("nodemailer")

const utils = require(path.join(__dirname, "utils.js"))
const {loadEmailsForUsers} = require("./firebase-admin.js")

const getSearchLink = require("../src/getSearchLink.js")

let password;
try {
	password = fs.readFileSync(path.join(utils.getDataDirectory(), "notifications", "gmailpassword.txt"), {encoding:"utf8"}) //gmailpassword should be an application key. 2 factor auth needed.
}
catch (e) {
	console.error(e)
}

async function sendEmail(user) {
	//Create the email
	//We can give them lots of info we couldn't before.
	var transporter = nodemailer.createTransport({
		service: 'gmail',
		secure: true,
		auth: {
			user: 'email.rivers.run@gmail.com',
			pass: password
		}
	});

	//TODO: Should we simply not send if all rivers are too low, etc?
	let mailInfo = getMessage(user)

	const mailOptions = {
	  from: 'rivergauges@rivers.run', //In order to have the profile image, this should be an alternative email for the gmail account.
	  to: user.auth.email,
	  subject: mailInfo.subject,
	  html: mailInfo.body
	};

	//Send the email
	await new Promise((resolve, reject) => {
		transporter.sendMail(mailOptions, function (err, info) {
		   if(err) {
				fs.appendFileSync(path.join(utils.getLogDirectory(), 'emailnotificationserrors.log'), JSON.stringify(err) + "\n");
			   resolve(false)
		   }
		   else {
				fs.appendFileSync(path.join(utils.getLogDirectory(), 'emailnotifications.log'), JSON.stringify(info) + "\n");
			   resolve(info)
		   }
		});
	})
}


const statuses = ["high", "running", "low", "unknown"]
const statusHeaders = ["Rivers that are Too High:", "Rivers that are Running:", "Rivers that are Too Low:", "Unclassified Rivers:"]

function getMessage(user) {
    let title = "River(s) are running!";
    let body = "";

	let statusMap = new Map()
	statuses.forEach((prop, i) => {
		statusMap.set(prop, [])
	});

	let IDs = []
	let favorites = user.favorites
	for (let gaugeID in favorites) {
		let rivers = favorites[gaugeID]
		for (let riverID in rivers) {
			let river = rivers[riverID]
			IDs.push(riverID)
			statusMap.get(river.status).push(river)
		}
	}

	function getIDs(rivers) {
		return rivers.map((river) => {
			return river.id
		})
	}


	let running = statusMap.get("running")

    if (running.length === 0) {
       	title = "Rivers are not running"
    }
    //If a rivers name ends with Creek, don't use the work "The"
    else if (running.length === 1) {
        title = (running[0].name.trim().endsWith("Creek")?"":"The ") + running[0].name + " is running!"
    }
    else if (running.length === 2) {
        title = "2 rivers are running!"
    }
    else {
        title = running.length + " rivers are running!"
    }

	//Note: Only inline style appears to be allowed.
	//TODO: Use a script inliner.

	body = [
		`<html><head></head><body>`,
	]

	function createListItem(river) {
		//TODO: Should we send both units (river.flowInfo), or river.current + river.units when we have units?
		//The first gives more info, the second is easier to read.
		let str = "<li>" + `<a href="${getSearchLink([river.id])}">${river.name + (river.section?` (${river.section})`:"")}<a>`
		str += `: ${river.flowInfo} `
		//Inform user of flow range, or why the river isn't classified
		if (!river.units) {
			str += " - No Units Selected"
		}
		else if (river.minimum === undefined && river.maximum === undefined) {
			str += " - No Min/Max Selected"
		}
		else {
			str += `(${river.minimum} ${river.units} - ${river.maximum} ${river.units})`
		}
		str += "</li>"
		return str
	}

	function createHeader(text) {
		return `<h2 style="margin-bottom: 0">${text}</h2>`
	}


	statuses.forEach((status, i) => {
		let rivers = statusMap.get(status)

		if (rivers.length === 0) {return}

		body.push(createHeader(statusHeaders[i]))
		body.push("<ul>")
		rivers.forEach((river) => {
			body.push(createListItem(river))
		})
		body.push(`<li style="font-size:0.9em;"><a href="${getSearchLink(getIDs(rivers))}">View all these on rivers.run</a></li>`)
		body.push("</ul>")
	});

	body.push(`<p><a href="${getSearchLink(IDs)}">View All Favorites on rivers.run</a></p>`)
    body.push(`<h1 style="margin-bottom:0.5em"><img src="https://rivers.run/resources/icons/64x64-Water-Drop.png" style="vertical-align: text-top; height:1em; width: 1em;"><a href="https://rivers.run" style="color:black">rivers.run</a></h1>`)
	body.push("<p><a href='mailto:support@rivers.run'>support@rivers.run</a></p>")

	body.push(`<p>Click <a href="https://rivers.run/favorites.html#${user.address}">here</a> to manage your subscription, or to unsubscribe.</p>`)

	body.push("</body></html>")

	return {
		subject: title,
		body: body.join(""),
	}
}

module.exports = {
	sendEmail
}
