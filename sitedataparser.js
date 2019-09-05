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
let riverData = lines.slice(dataStartIndex)

let sites = []
riverData.forEach((line) => {sites.push(line[1])})

console.log(sites.length)

//USGS can't handle such a massive request. Try only 1000 sites.
sites = sites.slice(0, 400)
console.log("trimming sites...")
console.log(sites.length)

let timeToRequest = 1000*86400
let url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=" + sites.join(",") +  "&startDT=" + new Date(Date.now()-timeToRequest).toISOString()  + "&parameterCd=00060,00065,00010,00011,00045&siteStatus=all"
fs.writeFileSync("url", url)