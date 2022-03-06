class DataSource {
	constructor({
		batchSize = 1, //Max gauges per request.
		concurrency = 1, //Max outstanding requests.
		batchCallback = function() {}, //Called with every batch that comes in successfully
		retries = 5, //Number of attempt to make to load each batch.
		retryDelay = 4000, //Delay between retries in milliseconds.
		timeout = 30000, //Timeout in milliseconds.
	}) {
		this.batchSize = batchSize
		this.concurrency = concurrency
		this.batchCallback = batchCallback
		this.retries = retries
		this.retryDelay = retryDelay
		this.timeout = timeout
	}

	gaugeIDCache = [] //Used to store gaugeIDs until a full batch can be made, or flush is called.

	//Determine when the current flush finishes - all requests open at the time of the flush are done.
	outstandingRequests = new Map()
	insertIndex = 0

	outstanding = 0; //For limiting concurrency.
	queue = [] //FILO - shouldn't be a problem within an individual data source.

	add(newGaugeIDs) {
		if (!(newGaugeIDs instanceof Array)) {newGaugeIDs = [newGaugeIDs]} //Allow passing a single gaugeID.
		this.gaugeIDCache.push(...newGaugeIDs)
		this.flush(true) //Only flush full blocks.
	}

	getBatches(onlyFull) {
		let offset = 0
		let slice = []

		let batches = []

		while (offset < this.gaugeIDCache.length) {
			slice = this.gaugeIDCache.slice(offset, offset + this.batchSize)
			if (onlyFull && slice.length !== this.batchSize) {
				break;
			}

			batches.push(slice)

			slice = [] //Clear slice - don't want these going back into this.gaugeIDCache
			offset += this.batchSize
		}
		this.gaugeIDCache = slice
		return batches
	}

	//Place gauges in this.gaugeIDCache into batches. Resolve when all existing calls finish.
	async flush(onlyFull, getPromise = false) {
		let batches = await this.getBatches(onlyFull)

		let batchCallback = this.batchCallback
		batches.forEach((slice) => {
			//Process slice.
			this.outstandingRequests.set(this.insertIndex++, this.processBatch(slice, this.insertIndex, batchCallback))
		})

		if (getPromise) {
			let promises = []
			let iterator = this.outstandingRequests.values()
			let last = iterator.next()
			while (last.done === false) {
				promises.push(last.value)
				last = iterator.next()
			}
			//TODO: It might be better to check this.outstandingRequests.size on every batch completed, instead of using Promise.all.
			//Not noticing a problem here though.
			await Promise.allSettled(promises) //Don't bother creating a Promise.allSettled unless asked.
		}
	}


	//dispatchCallbacks needs to be overridden for Canadian provinces, where the gaugeID is not actually returned as a property,
	//and other gauges are returned instead.
	async dispatchCallbacks(result, batch, callback) {
		if (batch.some((gaugeID) => {
			return result?.[gaugeID]
		})) {
			//This must be an object of gauges, as at least one gaugeID existed in the object.
			for (let gaugeID in result) {
				try {
					await callback(result[gaugeID], this.prefix + gaugeID)
				}
				catch (e) {console.error(e)}
			}
		}
		else if (result) {
			//Assume this is an individual gauge.
			await callback(result, this.prefix + batch[0])
		}
	}

	async processBatch(batch, insertIndex, callback) {
		if (this.outstanding >= this.concurrency) {
			//We need to wait.
			let queue = this.queue
			await new Promise((resolve, reject) => {
				queue.push(resolve)
			})
		}

		this.outstanding++

		let result;
		let i = 0
		//Add one to retries since it is RE-tries
		while (i < this.retries + 1) {
			try {
				i++
				let timeout = this.timeout
				result = await new Promise((resolve, reject) => {
					//Call the processBatch defined on the subclass.
					this._processBatch(batch).then(resolve, reject)
					setTimeout(function() {
						reject("Timeout Exceeded")
					}, timeout)
				})
				break;
			}
			catch (e) {
				console.error(e)
				console.error("Tried " + i + " times. ")

				let retryDelay = this.retryDelay
				await new Promise((resolve, reject) => {
					setTimeout(resolve, retryDelay*(i+1))
				})
			}
		}
		this.outstanding--
		this.outstandingRequests.delete(this.insertIndex)
		if (this.queue.length > 0) {
			this.queue.pop()()
		}

		await this.dispatchCallbacks(result, batch, callback)
	}

	removePrefix(code) {
		if (code.startsWith(this.prefix)) {
			return code.slice(this.prefix.length) //Codes already trimmed in dataparse.
		}
	}

	getValidCode(code) {return this.removePrefix(code)}
}

module.exports = DataSource
