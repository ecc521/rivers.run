function isValidOPWCode(code) {
	//code must be a five character string. Usually all digits.
	//Only codes between 00001 and 41000 are reccomended for re-publication, and it appears to be exclusive. (https://waterlevel.ie/faq/)
	if (isNaN(code)) {
		return false
	}
	code = String(code)
	code = ("0".repeat(5 - code.length)) + code

	if (Number(code) >= 41000 || Number(code) <= 1) {return false}
	return true
}


function isValidNWSCode(code) {
	//Appears to be 3-4 characters then number. Always 5 characters.
	return code.length === 5 && (!isNaN(code[4])) && isNaN(code)
}

function isValidUSGSCode(code) {
	return code.length > 7 && code.length < 16 && !isNaN(Number(code))
}

function validateCode(agency, code) {
	switch (agency) {
		case "USGS":
			return isValidUSGSCode(code) || "USGS codes should be an 8-15 digit number. "
		case "NWS":
			return isValidNWSCode(code) || "NWS codes should be a 5 character string. "
		case "ireland":
			return isValidNWSCode(code) || "Ireland OPW codes should be a 5 digit number between 00001 and 41000. "
		default:
			return true;
	}
}

module.exports = {
	isValidOPWCode,
	isValidUSGSCode,
	isValidNWSCode,
	validateCode,
}
