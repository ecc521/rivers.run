const fs = require("fs")
const path = require("path")
const utils = require(path.join(__dirname, "utils.js"))
const getRiverData = require(path.join(__dirname, "getRiverData.js"))

async function handleRequest(req, res) {
				
				
				let query = (await utils.getData(req)).toString()
				fs.appendFileSync(path.join(utils.getLogDirectory(), 'assistanterror.log'), query + "\n");
				query = JSON.parse(query)

				//Not sure if outputContexts works for this.
				let riverName = query.queryResult.outputContexts[0].parameters["river-name.original"] //What google said the river name was.
				let queryResult = getRiverData.getAssistantReply(riverName, query.queryResult.queryText) //Also pass the optional sentence parameter. This should allow most phrases to be exactly matched.
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
						"subtitle": "Rivers.run provides river information, such as real time water levels.",
						"imageUri": "https://rivers.run/resources/icons/128x128-Water-Drop.png",
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
						  }
						]
					  }
					}
				  }
				}

				reply.outputContexts = query.outputContexts

				res.statusCode = 200;
				res.setHeader('Content-Type', 'text/json');
				res.end(JSON.stringify(reply));
				
}

module.exports = {
	handleRequest
}