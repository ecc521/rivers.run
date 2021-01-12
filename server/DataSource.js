class DataSource() {
	constructor({
		batchSize = 1, //Max gauges per request.
		concurrency = 1, //Max outstanding requests.
		batchCallback = function() {}, //Called with every batch that comes in successfully
		retries = 5, //Number of attempt to make to load each batch.
		retryDelay = 2000 //Delay between retries in milliseconds.
	}) {
		let gaugeIDCache = []
		let requestCache = []

		this.add = function(newGaugeIDs) {
			if (!(newGaugeIDs instanceof Array)) {newGaugeIDs = [newGaugeIDs]} //Allow passing a single gaugeID.
			gaugeIDCache = gaugeIDCache.concat(newGaugeIDs)
			this.flush(true) //Only flush full blocks. 
		}

		//Place gauges in gaugeIDCache into batches. Resolve when all existing calls finish.
		this.flush = function(onlyFull = false) {
			let offset = 0
			let slice = []

			while (offset < gaugeIDCache.length) {
				let slice = gaugeIDCache.slice(offset, offset+batchSize)
				if (onlyFull && slice.length !== batchSize) {
					break;
				}

				//Process slice.
				requestCache.push(this.processBatch(slice, batchCallback))

				slice = []
				offset += batchSize
			}

			gaugeIDCache = slice
			return Promise.allSettled(requestCache)
		}


		let outstanding = 0;
		let queue = []

		this.processBatch = async function(batch, callback) {
			if (outstanding >= concurrency) {
				//We need to wait.
				await new Promise((resolve, reject) => {
					queue.push(resolve)
				})
			}
			concurrency++

			let result;
			for (let i=0;i<retries;i++) {
				try {
					let result = await _processBatch(batch)
					break;
				}
				catch (e) {
					console.error(e)
					await new Promise((resolve, reject) => {setTimeout(resolve, retryDelay)})
				}
			}
			concurrency--
			if (queue.length > 0) {
				queue.pop()()
			}
			callback(result)
		}
	}

	removePrefix(code) {
		if (code.startsWith(this.prefix)) {return code.slice(this.prefix.length)}
	}

	getValidCode(code) {return removePrefix(code)}
}

module.exports = DataSource
