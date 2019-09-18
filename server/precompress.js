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

async function compressFile(filePath, keepLastModified) {
	
	if ((await fs.promises.stat(filePath)).size > 5*1024*1024) {
		console.log(filePath + " is over 5MiB. Not compressing.")
		return;
	}
	
	let fileTimes;
	if (keepLastModified) {
		fileTimes = await fs.promises.stat(filePath)
	}
	
	let uncompressed = await fs.promises.readFile(filePath)
	
	let compressedPath = filePath + ".br"
	
	if (fs.existsSync(compressedPath)) {
		//If there is an existing file that decompressed to the input, don't waste time compressing again.
		let currentlyCompressed = zlib.brotliDecompressSync(await fs.promises.readFile(compressedPath))
		if (currentlyCompressed.toString() === uncompressed.toString()) {
			console.log(filePath + " is already compressed.")
			return;
		}
	}
	
	console.log("Compressing " + filePath)
	
	let compressed = await brotliCompressAsync(uncompressed, 11) //Pass 11 to compress at maximum level.

	//Note that some files may be compressed (uselessly) multiple times if the uncompressed file is smaller than the compressed file.
	if (compressed.byteLength < uncompressed.byteLength) {
		fs.writeFileSync(compressedPath, compressed)
		console.log("Compressed " + filePath + " from " + uncompressed.byteLength + " bytes to " + compressed.byteLength + " bytes.")
		
		if (keepLastModified) {
			await fs.promises.utimes(filePath, fileTimes.atime, fileTimes.mtime)
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
		if (dir.includes("node_modules") || dir.includes(".git") || dir.includes("data") || dir.includes("resources/icons")) {
			return false
		}
		return true
	})

	for (let i=0;i<files.length;i++) {
		let filePath = files[i]
		console.log("Compressing " + i + " of " + (files.length - 1))
		await compressFile(filePath)
	}
}


module.exports = {
	compressFiles,
	compressFile,
	brotliCompressAsync
}
