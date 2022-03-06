const usStatesAndTerriroties = {
	"AL": "Alabama",
	"AK": "Alaska",
	"AZ": "Arizona",
	"AR": "Arkansas",
	"CA": "California",
	"CO": "Colorado",
	"CT": "Connecticut",
	"DE": "Delaware",
	"DC": "District of Columbia",
	"FL": "Florida",
	"GA": "Georgia",
	"HI": "Hawaii",
	"ID": "Idaho",
	"IL": "Illinois",
	"IN": "Indiana",
	"IA": "Iowa",
	"KS": "Kansas",
	"KY": "Kentucky",
	"LA": "Louisiana",
	"ME": "Maine",
	"MD": "Maryland",
	"MA": "Massachusetts",
	"MI": "Michigan",
	"MN": "Minnesota",
	"MS": "Mississippi",
	"MO": "Missouri",
	"MT": "Montana",
	"NE": "Nebraska",
	"NV": "Nevada",
	"NH": "New Hampshire",
	"NJ": "New Jersey",
	"NM": "New Mexico",
	"NY": "New York",
	"NC": "North Carolina",
	"ND": "North Dakota",
	"OH": "Ohio",
	"OK": "Oklahoma",
	"OR": "Oregon",
	"PA": "Pennsylvania",
	"RI": "Rhode Island",
	"SC": "South Carolina",
	"SD": "South Dakota",
	"TN": "Tennessee",
	"TX": "Texas",
	"UT": "Utah",
	"VT": "Vermont",
	"VA": "Virginia",
	"WA": "Washington",
	"WV": "West Virginia",
	"WI": "Wisconsin",
	"WY": "Wyoming",
	"AS": "American Samoa",
	"GU": "Guam",
	"MP": "Northern Mariana Islands",
	"PR": "Puerto Rico",
	"UM": "U.S. Minor Outlying Islands",
	"VI": "U.S. Virgin Islands"
}

const canadianProvincesAndTerriroties = {
	"AB": "Alberta",
	"BC": "British Columbia",
	"MB": "Manitoba",
	"NB": "New Brunswick",
	"NL": "Newfoundland and Labrador",
	"NT": "Northwest Territories",
	"NS": "Nova Scotia",
	"NU": "Nunavut",
	"ON": "Ontario",
	"PE": "Prince Edward Island",
	"QC": "Quebec",
	"SK": "Saskatchewan",
	"YT": "Yukon Territory"
}


//Object insertion order is usually preserved.
//Since we want these to be alphabetical, sort alphabetically now.
let temporaryList = []

;[usStatesAndTerriroties, canadianProvincesAndTerriroties].forEach((obj) => {
	for (let prop in obj) {
		temporaryList.push([prop, obj[prop]])
	}
})

temporaryList.sort()

const statesProvincesTerritorys = {}

temporaryList.forEach((item) => {
	statesProvincesTerritorys[item[0]] = item[1]
})

statesProvincesTerritorys["Other"] = "Other"

module.exports = {
	usStatesAndTerriroties,
	canadianProvincesAndTerriroties,
	statesProvincesTerritorys,
}
