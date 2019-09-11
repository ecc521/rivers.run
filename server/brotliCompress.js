const zlib = require("zlib")

let compressionLevel = Number(process.argv[2])
let byteLength = Number(process.argv[3]) //Approxtimate byteLength of input.

const compress = zlib.createBrotliCompress({
  chunkSize: 32 * 1024,
  params: {
	[zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
	[zlib.constants.BROTLI_PARAM_QUALITY]: compressionLevel, //11 is Maximum compression level. 9 is the last level before a performance cliff. Little reason to use 10.
	[zlib.constants.BROTLI_PARAM_SIZE_HINT]: byteLength
  }
});

let compressionStream = process.stdin.pipe(compress);
compressionStream.pipe(process.stdout)