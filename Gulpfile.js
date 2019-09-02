const gulp = require("gulp")
const sourcemaps = require("gulp-sourcemaps")
const postcss = require('gulp-postcss');
const path = require("path")

//I initially tried to handle the CSS with webpack, however for some reason, I was getting a javascript file with a module.exports of the css code.
//I had trouble trying to extract what I wanted, so tried out the gulp-postcss module instead, and it worked.

function processCSS() {
	let stream = gulp.src('index.css')
		.pipe(sourcemaps.init())
		.pipe(postcss([
			require('postcss-preset-env')({
				autoprefixer: true,
				stage: 0
			}),
			require('postcss-css-variables')({
				preserveAtRulesOrder: true, //If the media rules are out of order, chaos ensues.
				preserve: true //As long as my bug (https://github.com/MadLittleMods/postcss-css-variables/issues/105) exists, this must be true.
				//Note that this doesn't fix issues in all browsers - so some browsers will behave a little weird.
				//preserve: "computed" //Allow css variables to be utilized by JavaScript. Although code should work just fine with false, currently using computed,
				//because that way any issues will only affect older browsers.
			}),
			require('cssnano')({
				preset: 'default',
			}),
		], {sourceMap: true}))
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest("packages"))

	stream.on("end", () => {
		console.log("Built CSS")
	})
}


gulp.task("cssbuild", function() {
	gulp.watch([
		path.join(__dirname, "/index.css")
	]).on("change", processCSS)

	processCSS()
})
