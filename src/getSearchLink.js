module.exports = function getSearchLink(IDs, prefix="https://rivers.run/") {
	let searchQuery = {
		id: IDs.join(","),
		sort: {
			query: "running"
		}
	}

	return encodeURI(prefix + "#" + JSON.stringify(searchQuery))
}
