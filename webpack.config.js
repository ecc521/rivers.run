const path = require("path")

module.exports = {
    mode: "production", //Build for production
    entry: {
        index: "./index.js"
    },
    target: "web",
    devtool: "source-map",
    output: {
        path: path.join(__dirname, "packages"),
        filename: "[name].js",
    },
    optimization: {
        minimize: false
    },    
    //Add babel plugin
}