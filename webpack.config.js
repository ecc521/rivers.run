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
			minimize: true //Consider using Uglify.js for minification.
			//https://github.com/mishoo/UglifyJS2/blob/ae67a4985073dcdaa2788c86e576202923514e0d/README.md#uglify-fast-minify-mode
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
							presets: [
								[
									'@babel/preset-env', {
									targets: {
										ie: 11,
										firefox: 60,
										safari: 9,
										chrome: 57, //No idea what a good minimum on this is.
										browsers: "last 2 versions"
									},
									useBuiltIns: 'usage'
								}]
							]
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
