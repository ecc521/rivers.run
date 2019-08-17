const path = require("path")

const ip2loc = require("ip2location-nodejs");
 
//IPV6 has a range containing all IPV4 Addresses, so the IPV6 database gets both IPV4 and IPV6.

//It takes a little bit of time to load the whole database, likely due to the speed of reading off the disk. It would probably be quicker to
//compress the database (brotli level 9 makes it 16MB) on disk, then decompress and use, however I don't think the tool supports it.
ip2loc.IP2Location_init(path.join(__dirname, "IP2LOCATION-LITE-DB11.IPV6.BIN"));

function lookupIP(address) {
    result = ip2loc.IP2Location_get_all(address);
	for (var key in result) {
		//Filter out parameters that the database don't contain.
		if (result[key] === "?" || (typeof result[key] === "string" && result[key].includes("This method is not applicable"))) {
			delete result[key]
		}
	}
	return result
}

module.exports = lookupIP