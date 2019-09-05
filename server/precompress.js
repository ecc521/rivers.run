const path = require("path")
const fs = require("fs")
const zlib = require("zlib")

const getFilesInDirectory = require(path.join(__dirname, "utils.js")).getFilesInDirectory

//TODO: Paralellize.

function brotliCompress(buf, compressionLevel = 9) {
	return zlib.brotliCompressSync(buf, {
	  chunkSize: 32 * 1024,
	  params: {
		[zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
		[zlib.constants.BROTLI_PARAM_QUALITY]: compressionLevel, //11 is Maximum compression level. 9 is the last level before a performance cliff. Little reason to use 10.
		[zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.byteLength
	  }
	})
}


function compressFile(filePath) {
	
	if (fs.statSync(filePath).size > 5*1024*1024) {
		console.log(filePath + " is over 5MiB. Not compressing.")
		return;
	}
	
	let uncompressed = fs.readFileSync(filePath)
	
	let compressedPath = filePath + ".br"
	
	if (fs.existsSync(compressedPath)) {
		//If there is an existing file that decompressed to the input, don't waste time compressing again.
		let currentlyCompressed = zlib.brotliDecompressSync(fs.readFileSync(compressedPath))
		if (currentlyCompressed.toString() === uncompressed.toString()) {
			console.log(filePath + " is already compressed.")
			return;
		}
	}
	
	let compressed = brotliCompress(uncompressed, 11) //Pass 11 to compress at maximum level.

	//Note that some files may be compressed (uselessly) multiple times if the uncompressed file is smaller than the compressed file.
	if (compressed.byteLength < uncompressed.byteLength) {
		fs.writeFileSync(compressedPath, compressed)
		console.log("Compressed " + filePath + " from " + uncompressed.byteLength + " bytes to " + compressed.byteLength + " bytes.")
	}
	else {
		if (fs.existsSync(compressedPath)) {
			fs.unlinkSync(compressedPath)
		}
		console.log("Failed to compress " + filePath)
	}
}

function compressFiles(directoryToCompress) {
	if (!fs.existsSync(directoryToCompress)) {throw "Directory " + directoryToCompress + " does not exist!"}
	
	let files = getFilesInDirectory(directoryToCompress)

	files = files.filter((filePath) => {
		let extension = path.extname(filePath).toLowerCase()
		if ([".png",".jpeg", ".jpg", ".br"].includes(extension)) {
			//Don't compress some precompessed file types.
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
		compressFile(filePath)
	}
}


module.exports = {
	compressFiles,
	brotliCompress,
	compressFile
}
