const fs = require("fs")
const path = require("path")
const child_process = require("child_process")
const os = require("os")


function handleRequest(req, res) {
				
				fs.appendFileSync(path.join(utils.getLogDirectory(), 'salmon2019.log'), req.url + "\n");

				res.setHeader("Cache-Control", "no-store")
				
				let filePath = path.relative("node/salmon2019", req.url.slice(1))
				//Stop users from messing with files that they shouldn't be allowed to.
				if (filePath.includes("../")) {
					res.statusCode = 200;
					res.setHeader('Content-Type', 'text/plain');
					//For the laughs
					res.end("Attempt to hijack server has been blocked. Logging your IP address and reporting to administrator. \n" + filePath)
					return;
				}
				let pathOnSystem = path.join(utils.getSiteRoot(), "salmon2019", filePath)
				if (req.url.endsWith("/")) {
					if (req.method === "POST") {
						if (fs.existsSync(pathOnSystem)) {
							res.statusCode = 400;
							res.setHeader('Content-Type', 'text/plain');
							res.end("Path exists")
							return
						}
						//Create the directory
						fs.mkdirSync(pathOnSystem, {recursive:true})
						res.statusCode = 200;
						res.setHeader('Content-Type', 'text/plain');
						//Apparently the configuration didn't carry into subdirectories - so link the files.
						fs.symlinkSync(path.join(utils.getSiteRoot(), "salmon2019", "header.html"), path.join(pathOnSystem, "header.html"))
						fs.symlinkSync(path.join(utils.getSiteRoot, "salmon2019", ".htaccess"), path.join(pathOnSystem, ".htaccess"))
						res.end("Directory created")
					}
					else {
						if (!fs.existsSync(pathOnSystem)) {
							res.statusCode = 400;
							res.setHeader('Content-Type', 'text/plain');
							res.end("Path does not exist.")
							return
						}
						//Send the user a zip file.
						let zipper = child_process.spawn("zip", ["-9", "-r", "-x", "header.html", "-x", ".htaccess", "-x", "*.br", "-", "."], {
							cwd: pathOnSystem,
							stido: ["ignore", "pipe", "pipe"] //Ingore stdin. Pipe others.
						})
						//Send stderr into log.
						let errorStream = fs.createWriteStream('salmon2019zip.log')
						zipper.stderr.pipe(errorStream)

						res.statusCode = 200;
						res.setHeader('Content-Type', 'application/zip');
						zipper.stdout.pipe(res) //Respond with the zip file.
					}
					return
				}
				else {
					if (fs.existsSync(pathOnSystem)) {
						res.statusCode = 400;
						res.setHeader('Content-Type', 'text/plain');
						res.end("Path exists")
						return
					}

					//If the file upload gets terminated for some reason, the user should be able to upload the file again without a path collison.
					let whileLoadingPath = path.join(os.tmpdir(), "rivers.run", filePath)
					if (!fs.existsSync(path.dirname(whileLoadingPath))) {
						fs.mkdirSync(path.dirname(whileLoadingPath), {recursive:true})
					}
					if (fs.existsSync(whileLoadingPath)) {fs.unlinkSync(whileLoadingPath)}

					let stream = req.pipe(fs.createWriteStream(whileLoadingPath))
					console.log(stream)
					stream.on("close", function() {
						fs.renameSync(whileLoadingPath, pathOnSystem)
						res.statusCode = 200;
						res.setHeader('Content-Type', 'text/plain');
						res.end("File created")
					})
					stream.on("error", function(e) {
						if (fs.existsSync(whileLoadingPath)) {fs.unlinkSync(whileLoadingPath)}
						res.statusCode = 500;
						res.setHeader('Content-Type', 'text/plain');
						res.end("Internal Server Error " + e.toString())
					})
					return;
				}
				res.statusCode = 200;
				res.setHeader('Content-Type', 'text/plain');
				res.end("Oh no! This request didn't work!\n" + req.url)
				
}

module.exports = {
	handleRequest
}