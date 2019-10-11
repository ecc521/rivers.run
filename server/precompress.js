const path = require("path")
const fs = require("fs")
const zlib = require("zlib")
const child_process = require("child_process")
const stream = require("stream")
const Buffer = require("buffer").Buffer
const os = require("os")

const utils = require(path.join(__dirname, "utils.js"))

async function brotliCompressAsync(input, compressionLevel = 9, priority = os.constants.priority.PRIORITY_LOW) {
	let args = [compressionLevel]

	if (input instanceof Buffer) {args.push(input.byteLength)}

	let compressor = child_process.fork(path.join(__dirname, "brotliCompress.js"), args, {stdio: "pipe"})

	os.setPriority(compressor.pid, priority)

	if (input instanceof stream) {
		input.pipe(compressor.stdin)
	}
	else if (input instanceof Buffer) {
		compressor.stdin.write(input)
		compressor.stdin.end()
	}

	compressor.stderr.on("data", function(data) {
		throw data.toString()
	})

	return await utils.getData(compressor.stdout)
}

async function compressFile(filePath, level = 11, options = {}) {

	//ignoreSizeLimit: Compress even if over 5MiB
	//alwaysCompress: Overwrite existing file regardless (don't check if existing file is same as current one.
	//keepLastModified: Copy lastModified from the uncompressed file onto the compressed one. (Should this happen by default?)

	if (!options.ignoreSizeLimit && (await fs.promises.stat(filePath)).size > 5*1024*1024) {
		console.log("\n" + filePath + " is over 5MiB. Not compressing.")
		return;
	}

	let fileTimes;
	if (options.keepLastModified) {
		fileTimes = await fs.promises.stat(filePath)
	}

	let uncompressed = await fs.promises.readFile(filePath)

	let compressedPath = filePath + ".br"

	if (!options.alwaysCompress && fs.existsSync(compressedPath)) {
		//If there is an existing file that decompressed to the input, don't waste time compressing again.
		//TODO: Stream into the brotli decompressor.
		let currentFile = await fs.promises.readFile(compressedPath)
		let currentlyCompressed = await new Promise((resolve, reject) => {
			zlib.brotliDecompress(currentFile, function(error, result) {
				if (error) {reject(error)}
				resolve(result)
			})
		})
		if (currentlyCompressed.equals(uncompressed)) {
			//console.log(filePath + " is already compressed.")
			return;
		}
	}

	process.stdout.write("\nCompressing " + filePath) //TODO: This should overwrite the previous line like how dataparse.js does.

	let compressed = await brotliCompressAsync(uncompressed, level)

	//Note that some files may be compressed (uselessly) multiple times if the uncompressed file is smaller than the compressed file.
	if (compressed.byteLength < uncompressed.byteLength) {
		await fs.promises.writeFile(compressedPath, compressed)
        process.stdout.write("\r\033[2K") //Clear current line		
		console.log("Compressed " + filePath + " from " + uncompressed.byteLength + " bytes to " + compressed.byteLength + " bytes.")

		if (options.keepLastModified) {
			await fs.promises.utimes(compressedPath, fileTimes.atime, fileTimes.mtime)
		}

	}
	else {
		if (fs.existsSync(compressedPath)) {
			await fs.promises.unlink(compressedPath)
		}
		console.log("Failed to compress " + filePath)
	}
}

async function compressFiles(directoryToCompress) {
	if (!fs.existsSync(directoryToCompress)) {throw "Directory " + directoryToCompress + " does not exist!"}

	let files = utils.getFilesInDirectory(directoryToCompress)

	files = files.filter((filePath) => {
		let extension = path.extname(filePath).toLowerCase()
		if ([".png",".jpeg", ".jpg", ".br", ".log"].includes(extension)) {
			//Don't compress some precompessed file types.
			//Also avoid compressing log files (mainly for performance reasons, as log files will almost always have changed)
			return false
		}
		let dir = path.dirname(filePath)
		if (dir.includes("node_modules") || dir.includes(".git") || dir.includes("data") || dir.includes("resources/icons") || dir.includes("gaugeReadings")) {
			return false
		}
		return true
	})
	
	for (let i=0;i<files.length;i++) {
		let filePath = files[i]
        process.stdout.write("\r\033[2K") //Clear current line		
		process.stdout.write("Compressing " + i + " of " + (files.length - 1))
		await compressFile(filePath)
	}
}


module.exports = {
	compressFiles,
	compressFile,
	brotliCompressAsync
}
