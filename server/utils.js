const path = require("path")
const fs = require("fs")


function getSiteRoot() {
	return path.dirname(__dirname)
}

function getLogDirectory() {
	let path = path.join(getSiteRoot(), "server", "logs")
	if (!fs.existsSync(path)) {fs.mkdirSync(path, {recursive: true})}
	return path
}

function getDataDirectory() {
	let path = path.join(getSiteRoot(), "server", "data")
	if (!fs.existsSync(path)) {fs.mkdirSync(path, {recursive: true})}
	return path
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


module.exports = {
	getSiteRoot,
	getLogDirectory,
	getDataDirectory,
	getFilesInDirectory
}