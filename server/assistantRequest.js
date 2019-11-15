const fs = require("fs")
const path = require("path")
const utils = require(path.join(__dirname, "utils.js"))
const getRiverData = require(path.join(__dirname, "getRiverData.js"))

async function handleRequest(req, res) {

				let query = (await utils.getData(req)).toString()
				query = JSON.parse(query)
				fs.appendFileSync(path.join(utils.getLogDirectory(), 'assistanterror.log'), JSON.stringify(query) + "\n");

				let sentence = query.queryResult.queryText
				let riverName = query.queryResult.parameters["river-name"]
				let unitName = query.queryResult.parameters["unit-name"]

				let queryResult = await getRiverData.getAssistantReply({
					name: riverName,
					units: unitName,
					sentence
				})
				let buttons = [];

				let continueConversation = false;

				if (typeof queryResult === "string") {
					buttons.push({
						"title": "View Rivers.run FAQ",
						"openUrlAction": "https://rivers.run/FAQ" //TODO: Send user to dedicated page for contributing content.
					})
				}
				else {
					buttons.push({
						"title": "View Full Search",
						"openUrlAction": "https://rivers.run/#" + queryResult.search
					})
					//TODO: Add edit this river link.
				}


				let reply = {
				  "fulfillmentText": queryResult.text,
				  /*"fulfillmentMessages": [
					{
					  "card": {
						"title": "Rivers.run Flow Info",
						"subtitle": "Rivers.run provides information, such as water levels, for whitewater rivers.",
						"buttons": buttons
					  }
					}
				],*/
				  "source": "https://rivers.run/",
				  "payload": {
					"google": {
					  "expectUserResponse": continueConversation,
					  "richResponse": {
						"items": [
						  {
							"simpleResponse": {
								"ssml": queryResult.ssml
							}
						  },
							{
								"basicCard": {
									"title": riverName + " Info",
									"formattedText": queryResult.text,
								  "buttons": buttons
								}
							}
						],
						  "linkOutSuggestion": {
							  "destinationName": "Go To rivers.run",
						  	"openUrlAction": "https://rivers.run/"
						  }
					  }
					}
				  }
				}

				reply.outputContexts = query.outputContexts

				fs.appendFileSync(path.join(utils.getLogDirectory(), 'assistanterror.log'), JSON.stringify(reply) + "\n");

				res.statusCode = 200;
				res.setHeader('Content-Type', 'text/json');
				res.end(JSON.stringify(reply));

}



async function handleAlexaRequest(req, res) {


				let query = (await utils.getData(req)).toString()
				query = JSON.parse(query)
				fs.appendFileSync(path.join(utils.getLogDirectory(), 'alexaskill.log'), JSON.stringify(query) + "\n");

				let queryResult = {
					ssml: "<speak>There was an error while generating a reply. This is probably a software bug, which you can report to support@rivers.run</speak>",
					text: "There was an error while generating a reply. This is probably a software bug, which you can report to support@rivers.run",
					responseName: "Server Error..."
				}
				
				try {
					let riverName = query.request.intent.slots.river_name.value
					queryResult = await getRiverData.getAssistantReply({
						name: riverName,
						units: "relative flow"
					})
				}
				catch(e) {
					fs.appendFileSync(path.join(utils.getLogDirectory(), 'alexaskill.log'), String(e) + "\n");
				}
	
				let continueConversation = false;

				let reply = {
				  "version": "1.0", //Consider simply returning the request version parameter.
				  "response": {
				    "outputSpeech": {
				      "type": "SSML",
				      "ssml": queryResult.ssml,
				      "playBehavior": "REPLACE_ENQUEUED"
				    },
				    "card": {
				      "type": "Standard",
				      "title": queryResult.responseName + " Information",
				      "text": queryResult.text,
				      "image": {
				        "smallImageUrl": "https://rivers.run/resources/icons/128x128-Water-Drop.png", //May not be needed.
				      }
				    },
				    "shouldEndSession": !continueConversation
				  }
				}


				res.statusCode = 200;
				res.setHeader('Content-Type', 'text/json');
				res.end(JSON.stringify(reply));

}


module.exports = {
	handleRequest,
	handleAlexaRequest
}
