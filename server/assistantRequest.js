const fs = require("fs")
const path = require("path")
const utils = require(path.join(__dirname, "utils.js"))
const getRiverData = require(path.join(__dirname, "getRiverData.js"))

async function handleRequest(req, res) {

				let query = (await utils.getData(req)).toString()
				fs.appendFileSync(path.join(utils.getLogDirectory(), 'assistanterror.log'), query + "\n");
				query = JSON.parse(query)

				let sentence = query.queryResult.queryText
				let riverName = query.queryResult.parameters["river-name"]
				let unitName = query.queryResult.parameters["unit-name"]
				
				let queryResult = getRiverData.getAssistantReply({
					name: riverName, 
					units: unitName,
					sentence
				})
				let buttons = [];

				let continueConversation = false;

				if (typeof queryResult === "string") {
					buttons.push({
						"text": "View Rivers.run FAQ",
						"postback": "https://rivers.run/FAQ" //TODO: Send user to dedicated page for contributing content.
					})
				}
				else {
					buttons.push({
						"text": "View Full Search",
						"postback": "https://rivers.run/#" + queryResult.search
					})
					//TODO: Add edit this river link.
				}


				let reply = {
				  "fulfillmentText": queryResult.ssml,
				  "fulfillmentMessages": [
					{
					  "card": {
						"title": "Rivers.run Flow Info",
						"subtitle": "Rivers.run provides information, such as water levels, for whitewater rivers.",
						"buttons": buttons
					  }
					}
				  ],
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
									"title": "View on Rivers.run",
									"formattedText": "See more information about " + queryResult.responseName + ", including trends, difficulty, location, and more!",
								  "buttons": buttons,
								  "image": "https://rivers.run/resources/icons/192x192-Water-Drop.png"
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
				fs.appendFileSync(path.join(utils.getLogDirectory(), 'alexaskill.log'), query + "\n");
				query = JSON.parse(query)

				let queryResult = {
					ssml: "<speak>Hello</speak>",
					responseName: "Test River"
				}
				//Not sure if outputContexts works for this.
				//let riverName = query.queryResult.outputContexts[0].parameters["river-name.original"] //What google said the river name was.
				//let queryResult = getRiverData.getAssistantReply(riverName, query.queryResult.queryText) //Also pass the optional sentence parameter. This should allow most phrases to be exactly matched.

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
				      "text": queryResult.ssml, //May actually need to be text.
				      "image": {
				        "smallImageUrl": "https://rivers.run/resources/icons/128x128-Water-Drop.png", //May not be needed.
				        //"largeImageUrl": ""
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
