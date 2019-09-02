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
				preserve: "computed" //Allow css variables to be utilized by JavaScript.
				//Because CSS variables don't work in some browsers, the javascript wont - but that will need to be fixed.
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
