class DataSource {
	constructor({
		batchSize = 1, //Max gauges per request.
		concurrency = 1, //Max outstanding requests.
		batchCallback = function() {}, //Called with every batch that comes in successfully
		retries = 5, //Number of attempt to make to load each batch.
		retryDelay = 2000, //Delay between retries in milliseconds.
		timeout = 36000, //Timeout in milliseconds.
	}) {

		let gaugeIDCache = [] //Used to store gaugeIDs until a full batch can be made, or flush is called.

		//Determine when the current flush finishes - all requests open at the time of the flush are done.
		let outstandingRequests = new Map()
		let insertIndex = 0

		this.add = function(newGaugeIDs) {
			if (!(newGaugeIDs instanceof Array)) {newGaugeIDs = [newGaugeIDs]} //Allow passing a single gaugeID.
			gaugeIDCache = gaugeIDCache.concat(newGaugeIDs)
			this.flush(true) //Only flush full blocks.
		}

		//Place gauges in gaugeIDCache into batches. Resolve when all existing calls finish.
		this.flush = function(onlyFull = false, getPromise = false) {
			let offset = 0
			let slice = []

			while (offset < gaugeIDCache.length) {
				slice = gaugeIDCache.slice(offset, offset+batchSize)
				if (onlyFull && slice.length !== batchSize) {
					break;
				}

				//Process slice.
				outstandingRequests.set(insertIndex++, this.processBatch(slice, insertIndex, batchCallback))

				slice = []
				offset += batchSize
			}

			gaugeIDCache = slice
			if (getPromise) {
				let promises = []
				let iterator = outstandingRequests.values()
				let last = iterator.next()
				while (last.done === false) {
					promises.push(last.value)
					last = iterator.next()
				}
				//TODO: It might be better to check outstandingRequests.size on every batch completed, instead of using Promise.all.
				//Not noticing a problem here though. 
				return Promise.allSettled(promises) //Don't bother creating a Promise.allSettled unless asked.
			}
		}


		let outstanding = 0; //For limiting concurrency.
		let queue = [] //FILO - shouldn't be a problem within an individual data source.

		this.processBatch = async function(batch, insertIndex, callback) {
			if (outstanding >= concurrency) {
				//We need to wait.
				await new Promise((resolve, reject) => {
					queue.push(resolve)
				})
			}

			outstanding++

			let result;
			for (let i=0;i<retries;i++) {
				try {
					result = await new Promise((resolve, reject) => {
						this._processBatch(batch).then(resolve, reject)
						setTimeout(function() { //TODO: Check this. Mem
							reject("Timeout Exceeded")
						}, timeout)
					})
					break;
				}
				catch (e) {
					//We are going to suppress logging somewhat, as errors (timeout, connection reset) are very common on the Canadian gauges,
					//however it usually works just fine on retry.

					if (i + 1 === retries) {
						console.error("Error on the following batch: ")
						console.error(batch)
						console.trace(e)
						console.error("Loading Failed. Already tried" + retries + "times. ")
					}
					else {
						await new Promise((resolve, reject) => {
							setTimeout(resolve, retryDelay*(i+1))
						})
					}
				}
			}
			outstanding--
			outstandingRequests.delete(insertIndex)
			if (queue.length > 0) {
				queue.pop()()
			}

			if (batch.some((gaugeID) => {
				return result?.[gaugeID]
			})) {
				//This must be an object of gauges, as at least one gaugeID existed in the object.
				for (let gaugeID in result) {
					try {
						callback(result[gaugeID], this.prefix + gaugeID)
					}
					catch (e) {console.error(e)}
				}
			}
			else if (result) {
				//Assume this is an individual gauge.
				callback(result, this.prefix + batch[0])
			}
		}
	}

	removePrefix(code) {
		if (code.startsWith(this.prefix)) {
			return code.slice(this.prefix.length)
		}
	}

	getValidCode(code) {return this.removePrefix(code)}
}

module.exports = DataSource
