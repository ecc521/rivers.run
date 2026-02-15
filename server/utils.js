const path = require("path")
const fs = require("fs")


function getSiteRoot() {
	return path.dirname(__dirname)
}

function getLogDirectory() {
	let src = path.join(getSiteRoot(), "server", "logs")
	if (!fs.existsSync(src)) {fs.mkdirSync(src, {recursive: true})}
	return src
}

function getDataDirectory() {
	let src = path.join(getSiteRoot(), "server", "data")
	if (!fs.existsSync(src)) {fs.mkdirSync(src, {recursive: true})}
	return src
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

function appendLog(filename, data, maxSize = 5 * 1024 * 1024) {
	let logDir = getLogDirectory()
	let logPath = path.join(logDir, filename)

	try {
		if (fs.existsSync(logPath)) {
			let stats = fs.statSync(logPath)
			if (stats.size > maxSize) {
				let oldLogPath = logPath + ".old"
				if (fs.existsSync(oldLogPath)) {
					fs.unlinkSync(oldLogPath)
				}
				fs.renameSync(logPath, oldLogPath)
			}
		}
		fs.appendFileSync(logPath, data)
	} catch (e) {
		console.error("Error writing to log file:", e)
	}
}


//Gets the body of a request.
		function getData(request, limit = 25 * 1024 * 1024) {
			return new Promise((resolve, reject) => {
				let body = []
				let size = 0

				request.on("error", function(err) {
					reject(err)
				})

				request.on("data", function(chunk) {
					size += chunk.length
					if (size > limit) {
						let err = new Error("Request body too large")
						//Stop listening to prevent further data processing
						if (request.destroy) {
							request.destroy(err)
						}
						else {
							reject(err)
							//Stop listening to prevent further data processing
							request.pause()
							//Remove listeners to allow garbage collection
							request.removeAllListeners()
						}
						return
					}
					body.push(chunk)
				})
				request.on("end", function() {
					resolve(Buffer.concat(body))
				})
			})
		}

module.exports = {
	getSiteRoot,
	getLogDirectory,
	getDataDirectory,
	getFilesInDirectory,
	getData,
	appendLog
}
