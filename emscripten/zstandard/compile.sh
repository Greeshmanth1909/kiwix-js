echo "Compiling ASM version zstddec-asm.js"
emcc --memory-init-file 0 -O3 --closure 1 -s ENVIRONMENT="web" -s WASM=0 -s MALLOC="emmalloc" -s TOTAL_MEMORY=150994944 -s FILESYSTEM=0 -s DOUBLE_MODE=0 -s DYNAMIC_EXECUTION=0 -s MIN_IE_VERSION=11 -s MIN_CHROME_VERSION=57 -s MIN_FIREFOX_VERSION=52 -s EXPORT_NAME="ZD" -s MODULARIZE=1 -s EXPORT_ES6=1 -s EXPORTED_FUNCTIONS="['_malloc', '_free', '_ZSTD_createDStream', '_ZSTD_initDStream', '_ZSTD_decompressStream', '_ZSTD_isError', '_ZSTD_getErrorName', '_ZSTD_freeDStream', '_ZSTD_DStreamInSize', '_ZSTD_DStreamOutSize']" -s EXPORTED_RUNTIME_METHODS="['cwrap']" ./*.c -o zstddec-asm.js
echo "Compiling WASM version zstddec-wasm.js"
emcc --memory-init-file 0 -O3 --closure 1 -s ENVIRONMENT="web" -s WASM=1 -s MALLOC="emmalloc" -s TOTAL_MEMORY=150994944 -s FILESYSTEM=0 -s DOUBLE_MODE=0 -s DYNAMIC_EXECUTION=0 -s MIN_CHROME_VERSION=57 -s MIN_FIREFOX_VERSION=52 -s EXPORT_NAME="ZD" -s MODULARIZE=1 -s EXPORT_ES6=1 -s EXPORTED_FUNCTIONS="['_malloc', '_free', '_ZSTD_createDStream', '_ZSTD_initDStream', '_ZSTD_decompressStream', '_ZSTD_isError', '_ZSTD_getErrorName', '_ZSTD_freeDStream', '_ZSTD_DStreamInSize', '_ZSTD_DStreamOutSize']" -s EXPORTED_RUNTIME_METHODS="['cwrap']" ./*.c -o zstddec-wasm.js
echo "Finished."
