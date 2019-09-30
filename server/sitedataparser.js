const fs = require("fs")

//Gzip file from 
//https://waterdata.usgs.gov/nwis/current?index_pmcode_STATION_NM=1&index_pmcode_DATETIME=2&index_pmcode_30208=3&index_pmcode_00061=4&index_pmcode_00065=5&group_key=county_cd&format=sitefile_output&sitefile_output_format=rdb_gz&column_name=agency_cd&column_name=site_no&column_name=station_nm&column_name=site_tp_cd&column_name=lat_va&column_name=long_va&column_name=dec_lat_va&column_name=dec_long_va&column_name=coord_meth_cd&column_name=coord_acy_cd&column_name=coord_datum_cd&column_name=dec_coord_datum_cd&column_name=district_cd&column_name=state_cd&column_name=county_cd&column_name=country_cd&column_name=land_net_ds&column_name=map_nm&column_name=map_scale_fc&column_name=alt_va&column_name=alt_meth_cd&column_name=alt_acy_va&column_name=alt_datum_cd&column_name=huc_cd&column_name=basin_cd&column_name=topo_cd&column_name=data_types_cd&column_name=instruments_cd&column_name=construction_dt&column_name=inventory_dt&column_name=drain_area_va&column_name=contrib_drain_area_va&column_name=tz_cd&column_name=local_time_fg&column_name=reliability_cd&column_name=gw_file_cd&column_name=nat_aqfr_cd&column_name=aqfr_cd&column_name=aqfr_type_cd&column_name=well_depth_va&column_name=hole_depth_va&column_name=depth_src_cd&column_name=project_no&column_name=rt_bol&column_name=peak_begin_date&column_name=peak_end_date&column_name=peak_count_nu&column_name=qw_begin_date&column_name=qw_end_date&column_name=qw_count_nu&column_name=gw_begin_date&column_name=gw_end_date&column_name=gw_count_nu&column_name=sv_begin_date&column_name=sv_end_date&column_name=sv_count_nu&sort_key_2=site_no&html_table_group_key=NONE&rdb_compression=gz&list_of_search_criteria=realtime_parameter_selection
//When unzipped, get file sites

let data = fs.readFileSync("sites", {encoding:"utf8"})
let lines = data.split("\n")
console.log(lines.length)
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

newArr = newArr.slice(0, 3000)

function fixCasing(str) {
   var splitStr = str.toLowerCase().split(' ');
   for (var i = 0; i < splitStr.length; i++) {
       splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);     
   }
   return splitStr.join(' '); 
}

newArr.forEach((obj, index) => {
	let reducedObj = {}
	
	let siteName = obj.station_nm
	
	siteName = siteName.split("nr").join("near").split("NR").join("NEAR")
	siteName = fixCasing(siteName)

	let splitIndex = siteName.search(/ (?:below|above|near|at)/i)

	reducedObj.name = siteName.slice(0, splitIndex).trim()
	reducedObj.section = siteName.slice(splitIndex).trim()
	reducedObj.tags = ""
	reducedObj.writeup = ""
	reducedObj.usgs = obj.site_no
	reducedObj.plat = obj.dec_lat_va
	reducedObj.plon = obj.dec_long_va
	reducedObj.drainageArea = obj.drain_area_va

	newArr[index] = reducedObj
})

//console.log(legend)
//console.log(riverData[2])

//console.log(newArr[2])

fs.writeFileSync("rivers.run/riverdata.json", JSON.stringify(newArr))

/*let sites = []
riverData.forEach((line) => {sites.push(line[1])})

console.log(sites.length)

console.log(sites[2])*/