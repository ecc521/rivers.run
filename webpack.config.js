const path = require("path")

module.exports = {
    mode: "production", //Build for production
    entry: __dirname, //Bundle all files in directory
    target: "web",
    devtool: "source-map",
    output: {
        path: __dirname,
        filename: "package.js",
    },
	optimization: {
		minimize: false
	},    
    //Add babel plugin
}