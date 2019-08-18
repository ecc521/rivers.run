const path = require("path")
const fs = require("fs")
const zlib = require("zlib")


//Note - the compression is done synchronusly, which will make it very slow.
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
	
	let compressed = zlib.brotliCompressSync(uncompressed, {
	  chunkSize: 32 * 1024,
	  params: {
		[zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
		[zlib.constants.BROTLI_PARAM_QUALITY]: 11, //Maximum compression level.
		[zlib.constants.BROTLI_PARAM_SIZE_HINT]: uncompressed.byteLength
	  }
	})

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


function getFilesInDirectory (dir, files_){
    
    files_ = files_ || [];
	    
    //Return if we were passed a file or symbolic link
    let dirStats = fs.lstatSync(dir)
    if (dirStats.isSymbolicLink()) {
        return [];
    }
    if (!dirStats.isDirectory()) {
        return [dir]
    }

    let files;

    try {
        files = fs.readdirSync(dir);
    }
    catch (e) {
        //Likely a permission denied error
        //Return an empty array
        console.warn(e);
        return []
    }

    for (var i in files){
        let name = path.join(dir, files[i])
        //Currently ignores symbolic links
        //Change lstatSync to statSync to stat the target of the symbolic link, not the link itself
        
        let stats = fs.lstatSync(name) 

        if (stats.isSymbolicLink()) {
            continue; 
        }

        if (stats.isDirectory()){
            getFilesInDirectory(name, files_);
        } 
        else {
            files_.push(name);
        }
    }
    return files_;
}




module.exports = function compressFiles() {
	let files = getFilesInDirectory(__dirname)

	files = files.filter((filePath) => {
		if ([".png",".jpeg",".br"].includes(path.extname(filePath))) {
			//Don't compress some precompessed file types.
			return false
		}
		let dir = path.dirname(filePath)
		if (dir.includes("node_modules") || dir.includes(".git") || dir.includes("drivecache") || dir.includes("data") || dir.includes("resources/icons")) {
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
