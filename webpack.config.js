const path = require("path")

//Development build:
//npm run webpack -- --env dev

//Production build:
//webpack


	let prodConfig = {
		mode: "production", //Build for production
		entry: {
			//virtualGaugeCalculator: "./virtualGaugeCalculator.js", //virtualGaugeCalculator.js is manually transfered into an inline script. Remember to change source map url.
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
		stats: {
			colors: true
		},
		module: {
			rules: [
				{
					test: /\.js$/,
					exclude: /node_modules/,
					use: {
						loader: 'babel-loader',
						options: {
							cacheDirectory: true, //Huge performance boost. Avoid recompiling when unneeded.
							cacheCompression: true, //true is default. Compress cached data written to disk.
							presets: ['@babel/preset-env']
						}
					}
				}
			]
		}
	}


	let devConfig = {
		mode: "production", //Build for "production" - Not sure if needed, but CSP may require.
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
			minimize: false
		},
		stats: {
			colors: true
		}
	}



module.exports = function(env) {
	if (env === "dev") {
		return devConfig
	}
	else {
		return prodConfig
	}

	return output
}
