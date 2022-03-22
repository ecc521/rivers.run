const webpack = require('webpack');

let config = {
	mode: "production", //Build for production
	entry: {
		"packages/index.js": "./src/index.js",
		"packages/allPages.js": "./src/allPages/allPages.js",
		"packages/writeupmaker.js": "./resources/writeupmaker.js",
		"packages/map.js": "./map.js",
		"packages/favorites.js": "./favorites.js",
		"packagedsw.js": "./sw.js",
		"native/packages/index.js": "./native/index.js",
	},
	watch: true,
	target: "web",
	devtool: "source-map",
	output: {
		path: __dirname,
		filename: "[name]",
	},
	optimization: {
		minimize: false //Consider using Uglify.js for minification.
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
						sourceType: 'unambiguous', //Allow mixing CommonJS and ES6 modules.
						presets: [
							[
							"@babel/preset-env",
							{
								"useBuiltIns": "usage",
								"corejs": {
									"version": 3,
									"proposals": true
								}
							}
						]
						]
					}
				}
			}
		]
	}
}

let compiler = webpack(config);
config.optimization.minimize = true
let minimizingCompiler = webpack(config);


function compilerCallback(err, stats) {
	if (err) {
		console.error(err.stack || err);
		if (err.details) {
			console.error(err.details);
		}
		return;
	}

	const info = stats.toJson();

	if (stats.hasErrors()) {
		console.error(info.errors.join(""));
	}

	if (stats.hasWarnings()) {
		console.warn(info.warnings.join(""));
	}

	// Log result...
	console.log(
		stats.toString({
			chunks: false,  // Makes the build much quieter
			colors: true  // Add console colors
		})
	);
}


function run(compilerToRun) {
	return new Promise((resolve, reject) => {
		compilerToRun.run(function(...args) {
			compilerCallback(...args)
			compilerToRun.close((closeErr) => {
				if (closeErr === null) {resolve()}
				reject(closeErr)
			});
		})
	})
}

function runProd() {return run(minimizingCompiler)}
function runDev() {return run(compiler)}

function watchDev() {
	compiler.watch({
		aggregateTimeout: 100,
		ignored: /node_modules/
	}, compilerCallback)
}

module.exports = {runProd, runDev, watchDev}
