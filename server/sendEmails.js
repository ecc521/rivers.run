const fs = require("fs")
const path = require("path")
const nodemailer = require("nodemailer")

const utils = require(path.join(__dirname, "utils.js"))

let password;
try {
	password = fs.readFileSync(path.join(utils.getDataDirectory(), "notifications", "gmailpassword.txt"), {encoding:"utf8"}) //gmailpassword should be an application key. 2 factor auth needed.
}
catch (e) {
	fs.appendFileSync(path.join(utils.getLogDirectory(), 'emailpassword.log'), e.toString() + "\n");
}

function sendEmail(addresses, data) {
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
	
	let mailInfo = getMessage(data, addresses[0])
	
	if (mailInfo === false) {return false}; //All rivers are too low.
	
	const mailOptions = {
	  from: 'rivergauges@rivers.run', //In order to have the profile image, this should be an alternative email for the gmail account.
	  to: addresses, // list of receivers
	  subject: mailInfo.subject, // Subject line
	  html: '<p>' + mailInfo.body + '</p>'// Body
	};
	
	//Send the email
	transporter.sendMail(mailOptions, function (err, info) {
	   if(err)
		 console.log(err)
	   else
		 console.log(info);
	});
}


function getMessage(data, address) {
    let title = "River(s) are running!";
    let body = "";

    let IDs = []
	
	let running = []
	let tooHigh = []
	let tooLow = []
	
	for (let id in data) {
		if (data[id].running !== false) {
	        running.push(data[id])		
		}
		else if (data[id].current < data[id].minimum) {
			tooLow.push(data[id])
		}
		else {
			tooHigh.push(data[id])
		}
        IDs.push(id)
    }
	
	function getIDs(rivers) {
		return rivers.map((river) => {
			return river.id
		})
	}

	function getSearchLink(IDs) {
		let searchQuery = {
			id: IDs.join(","),
			sort: {
				query: "running"
			}
		}

		return encodeURI("https://rivers.run/#" + JSON.stringify(searchQuery))
	}
	
	if (tooHigh + running === 0) {return false;}
	
    console.log(data)
	console.log(running)

    if (running.length === 0) {
       	title = "Rivers are no longer running"
		
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
	
	
	body = [
		`<html><head></head><body>`,
	]
	
	if (tooHigh.length > 0) {
		body.push(`<h2 style="margin-bottom: 0">Rivers that are Too High:</h2>`)
		body.push("<ul>")
		tooHigh.forEach((river) => {
			body.push("<li>" + `<a href="${getSearchLink([river.id])}">${river.name}<a>` + ": " + river.current + river.units + " (" + river.minimum + river.units + " - " + river.maximum + river.units + ")" + "</li>")
		})
		body.push(`<li style="font-size:0.9em;"><a href="${getSearchLink(getIDs(tooHigh))}">View all these on rivers.run</a></li>`)
		body.push("</ul>")
	}
	
	if (running.length > 0) {
		body.push(`<h2 style="margin-bottom: 0">Rivers that are Running:</h2>`)
		body.push("<ul>")
		running.forEach((river) => {
			body.push("<li>" + `<a href="${getSearchLink([river.id])}">${river.name}<a>` + ": " + river.current + river.units + " (" + river.minimum + river.units + " - " + river.maximum + river.units + ")" + "</li>")
		})
		body.push(`<li style="font-size:0.9em;"><a href="${getSearchLink(getIDs(running))}">View all these on rivers.run</a></li>`)
		body.push("</ul>")
	}
	
	if (tooLow.length > 0) {
		body.push(`<h2 style="margin-bottom: 0">Rivers that are Too Low:</h2>`)
		body.push("<ul>")
		tooLow.forEach((river) => {
			body.push("<li>" + `<a href="${getSearchLink([river.id])}">${river.name}<a>` + ": " + river.current + river.units + " (" + river.minimum + river.units + " - " + river.maximum + river.units + ")" + "</li>")
		})
		body.push(`<li style="font-size:0.9em;"><a href="${getSearchLink(getIDs(tooLow))}">View all these on rivers.run</a></li>`)
		body.push("</ul>")
	}
	
	body.push(`<p><a href="${getSearchLink(IDs)}">View All My Rivers on rivers.run</a></p>`)
    body.push(`<h1 style="margin-bottom:0.5em"><img src="rivers.run/resources/icons/64x64-Water-Drop.png" style="vertical-align: text-top; height:1em; width: 1em;"><a href="https://rivers.run" style="color:black">rivers.run</a></h1>`)
	body.push("<p><a href='mailto:support@rivers.run'>support@rivers.run</a></p>")
	
	body.push(`Click <a href="https://rivers.run/emailnotifications.html#${address}">here</a> to manage your subscription, or to unsubscribe.`)
	
	body.push("</body></html>")
	
	return {
		subject: title,
		body: body.join("")
	}
}

module.exports = {
	sendEmail
}