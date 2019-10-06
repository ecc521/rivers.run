const fs = require("fs")
const path = require("path")

const fetch = require("node-fetch")

const utils = require(path.join(__dirname, "utils.js"))

const zlib = require("zlib")

const stateLookupTable = require(path.join(__dirname, "stateCodeLookupTable.js"))

let sitesFilePath = path.join(utils.getDataDirectory(), "usgsSites.txt")

//Gzip file from
//https://waterdata.usgs.gov/nwis/current?index_pmcode_STATION_NM=1&index_pmcode_DATETIME=2&index_pmcode_30208=3&index_pmcode_00061=4&index_pmcode_00065=5&group_key=county_cd&format=sitefile_output&sitefile_output_format=rdb_gz&column_name=agency_cd&column_name=site_no&column_name=station_nm&column_name=site_tp_cd&column_name=lat_va&column_name=long_va&column_name=dec_lat_va&column_name=dec_long_va&column_name=coord_meth_cd&column_name=coord_acy_cd&column_name=coord_datum_cd&column_name=dec_coord_datum_cd&column_name=district_cd&column_name=state_cd&column_name=county_cd&column_name=country_cd&column_name=land_net_ds&column_name=map_nm&column_name=map_scale_fc&column_name=alt_va&column_name=alt_meth_cd&column_name=alt_acy_va&column_name=alt_datum_cd&column_name=huc_cd&column_name=basin_cd&column_name=topo_cd&column_name=data_types_cd&column_name=instruments_cd&column_name=construction_dt&column_name=inventory_dt&column_name=drain_area_va&column_name=contrib_drain_area_va&column_name=tz_cd&column_name=local_time_fg&column_name=reliability_cd&column_name=gw_file_cd&column_name=nat_aqfr_cd&column_name=aqfr_cd&column_name=aqfr_type_cd&column_name=well_depth_va&column_name=hole_depth_va&column_name=depth_src_cd&column_name=project_no&column_name=rt_bol&column_name=peak_begin_date&column_name=peak_end_date&column_name=peak_count_nu&column_name=qw_begin_date&column_name=qw_end_date&column_name=qw_count_nu&column_name=gw_begin_date&column_name=gw_end_date&column_name=gw_count_nu&column_name=sv_begin_date&column_name=sv_end_date&column_name=sv_count_nu&sort_key_2=site_no&html_table_group_key=NONE&rdb_compression=gz&list_of_search_criteria=realtime_parameter_selection
//When unzipped, get file sites

function fixCasing(str) {
   var splitStr = str.toLowerCase().split(' ');
   for (var i = 0; i < splitStr.length; i++) {
       splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
   }
   return splitStr.join(' ');
}


let stateCodeToName = {}
for (let prop in stateLookupTable) {
    let stateCode = stateLookupTable[prop][0]
    let stateName = stateLookupTable[prop][1]
    stateCodeToName[stateCode] = stateName
}

function fixSiteName(siteName, convertStateCode) {
    siteName = siteName.split(/ nr /i).join(" near ").split(/ bl /i).join(" below ").split(/ dnstrm /i).join(" downstream ").split(/ abv /i).join(" above ")
        .split(" @ ").join(" at ").split(" S ").join(" South ").split(" N ").join(" North ").split(" E ").join(" East ").split(" W ").join(" West ")
        .split(/ Cr /i).join(" Creek ").split(/ Ck /i).join(" Creek ").split(/ R /i).join(" River ").split(/ CYN /i).join(" Canyon ")

    siteName = fixCasing(siteName)

    let stateCode = siteName.slice(-2).toUpperCase()
    let stateName = stateCodeToName[stateCode]
    //Make stateCode upperCase if convertStateCode is false. Otherwise, replace with stateName.
    if (stateName) {
        siteName = siteName.slice(0, -2)
        if (convertStateCode) {
            siteName += stateName
        }
        else {
            siteName += stateCode
        }
    }
    return siteName
}


async function getSites() {
	//Make sure we have the sites file.
	if (!fs.existsSync(sitesFilePath)) {
		console.log("Downloading Gauge List from USGS (May take a while)")
		let url = "https://waterdata.usgs.gov/nwis/current?index_pmcode_STATION_NM=1&index_pmcode_DATETIME=2&index_pmcode_30208=3&index_pmcode_00061=4&index_pmcode_00065=5&group_key=county_cd&format=sitefile_output&sitefile_output_format=rdb_gz&column_name=agency_cd&column_name=site_no&column_name=station_nm&column_name=site_tp_cd&column_name=lat_va&column_name=long_va&column_name=dec_lat_va&column_name=dec_long_va&column_name=coord_meth_cd&column_name=coord_acy_cd&column_name=coord_datum_cd&column_name=dec_coord_datum_cd&column_name=district_cd&column_name=state_cd&column_name=county_cd&column_name=country_cd&column_name=land_net_ds&column_name=map_nm&column_name=map_scale_fc&column_name=alt_va&column_name=alt_meth_cd&column_name=alt_acy_va&column_name=alt_datum_cd&column_name=huc_cd&column_name=basin_cd&column_name=topo_cd&column_name=data_types_cd&column_name=instruments_cd&column_name=construction_dt&column_name=inventory_dt&column_name=drain_area_va&column_name=contrib_drain_area_va&column_name=tz_cd&column_name=local_time_fg&column_name=reliability_cd&column_name=gw_file_cd&column_name=nat_aqfr_cd&column_name=aqfr_cd&column_name=aqfr_type_cd&column_name=well_depth_va&column_name=hole_depth_va&column_name=depth_src_cd&column_name=project_no&column_name=rt_bol&column_name=peak_begin_date&column_name=peak_end_date&column_name=peak_count_nu&column_name=qw_begin_date&column_name=qw_end_date&column_name=qw_count_nu&column_name=gw_begin_date&column_name=gw_end_date&column_name=gw_count_nu&column_name=sv_begin_date&column_name=sv_end_date&column_name=sv_count_nu&sort_key_2=site_no&html_table_group_key=NONE&rdb_compression=gz&list_of_search_criteria=realtime_parameter_selection"

		let unzipper = zlib.createGunzip()
		await new Promise((resolve, reject) => {
			fetch(url).then((response) => {
				//TODO: Response is Gzipped. decompress.
				let dest = fs.createWriteStream(sitesFilePath)
				let stream = response.body.pipe(unzipper).pipe(dest)
				stream.on("finish", resolve)
			})
		})
		console.log("Gauge List Downloaded")
	}

	let data = await fs.promises.readFile(sitesFilePath, {encoding: "utf8"})
	let lines = data.split("\n")
	let legendIndex = lines.lastIndexOf(lines[0]) + 1
	let somethingWeirdIndex = legendIndex + 1 //Looks like time durations - but not sure at all.
	let dataStartIndex = legendIndex + 2

	lines = lines.map((line) => line.split("\t"))

	let legend = lines[legendIndex]
	let riverData = lines.slice(dataStartIndex, -1) //The last line is messed up. It only has agency_cd defined.


	let newArr = []

	riverData.forEach((line) => {
		let obj = {}
		line.forEach((value, index) => {
			obj[legend[index]] = value
		})
		newArr.push(obj)
	})

	newArr.forEach((obj, index) => {
		let reducedObj = {}

		let siteName = obj.station_nm

		siteName = fixSiteName(siteName)

		let splitIndex = siteName.search(/ (?:below|above|near|at|downstream|north of|east of|south of|west of) /i)

        if (splitIndex === -1) {
            reducedObj.name = siteName
            reducedObj.section = ""
        }
        else {
            reducedObj.name = siteName.slice(0, splitIndex).trim()
    		reducedObj.section = siteName.slice(splitIndex).trim()
        }
		let stateCode = obj.state_cd
		if (stateLookupTable[stateCode]) {
			//The lookup table doesn't handle the very rare things like gauges in other countires.
			reducedObj.state = stateLookupTable[obj.state_cd][0]
		}
		reducedObj.usgs = obj.site_no
		reducedObj.plat = obj.dec_lat_va
		reducedObj.plon = obj.dec_long_va
		//reducedObj.drainageArea = obj.drain_area_va //We don't use this, and it makes the file bigger.

		newArr[index] = reducedObj
	})

	console.log(newArr.length + " sites found.")

	return newArr
}


module.exports = {
	getSites,
    fixSiteName
}
