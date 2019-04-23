const path = require("path")

module.exports = {
    mode: "production", //Build for production
    entry: {
        index: "./index.js",
        allPages: "./allPages.js" //Package allPages.js for browser support.
    },
    target: "web",
    devtool: "source-map",
    output: {
        path: path.join(__dirname, "packages"),
        filename: "[name].js",
    },
    optimization: {
        minimize: true
    },   
    //Add babel plugin
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            }
        ]
    },
    stats: {
        colors: true
    },
}