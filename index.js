var fs = require('fs');
var path = require('path');
var through = require('through2');
var PassThrough = require('stream').PassThrough;
var asyncFilter = require('async-filter');
var tryall = require('tryall');
var mkdirp = require('mkdirp');

/**
 * Create a new StreamCache (or attach to an existing one)
 *
 * @constructor
 * @param {String} rootDirectory The directory in which to store cached objects.
 */
function StreamCache(rootDirectory) {
	this.rootCacheDirectory = rootDirectory;

	// TODO: Where's best to handle errors here?
	// Ensure the rootCacheDirectory is present.
	this.ready = new Promise(function(resolve, reject) {
		mkdirp(this.rootCacheDirectory, function(e) {
			if (e) {
				reject(e);
			} else {
				resolve();
			}
		});
	}.bind(this));
}

/**
 * Get a Stream from the cache, if the stream doesn't exist, create it via the
 * callback and cache it.
 *
 * @param {String} identifier                     The cache key.
 * @param {Object} options                        The options object.
 * @param {Function -> ReadStream} createCallback A function that can be used to create a new object if the cache key is empty.
 * @return {Promise -> ReadStream}
 */
StreamCache.prototype.get = function(identifier, options, createCallback) {

	var cache = this;

	return new Promise(function(resolve, reject) {
		cache.read(identifier, options).then(function(stream) {
			if (stream) {
				resolve(stream);
			} else {
				resolve(cache.writeThrough(identifier, createCallback()));
			}
		});
	});
};

/**
 * Purge the cache based on the filter function.  The function will take a
 * single argument of the cache key.  The function can then return true, if the
 * key should remain in the cache or false if the cache key should be purged.
 *
 * @example Purge everything in the cache
 *
 * cache.purge(function() { return true; });
 *
 * @param {Function} callback The filter function to determine whether the
 *                            cache key should be purged.
 */
StreamCache.prototype.purge = function(callback) {
	var cache = this;
	return new Promise(function(resolve, reject) {
		// Read the files that exist in the cache directory
		fs.readdir(cache.rootCacheDirectory, function(err, files) {
			if (err) {
				reject(err);
			}

			// Filter based on the callback function
			var filesToPurgePromise = asyncFilter(files, function(item) {
				var callbackResult = callback(item);
				return Promise.resolve(callbackResult);
			});

			// Try and purge all of the cached objects.  `tryall` will try
			// every promise and collect erroring promises as part of it's
			// resolved value.
			resolve(filesToPurgePromise.then(function(filesToPurge) {
				return tryall(filesToPurge.map(function(file) {
					return new Promise(function(innerResolve, innerReject) {
						fs.unlink(cache._getCachedObjectPath(file), function(err) {
							if (err) {
								innerReject(err);
							} else {
								innerResolve(true);
							}
						});
					});
				}));
			}));
		});
	});
};

StreamCache.prototype.read = function(identifier, options) {
	options = options || {};
	var cachedObjectPath = this._getCachedObjectPath(identifier);

	var newerThan = options.newerThan || 0;

	return new Promise(function(resolve, reject) {
		fs.open(cachedObjectPath, 'r', function(e, fd) {
			if (e) {
				resolve(false);
			} else {
				fs.fstat(fd, function(e, stats) {
					if (stats.mtime < newerThan) {
						resolve(false);
					} else {
						// First argument of fs.createReadStream is ignored
						// because the 'fd' is present
						var readStream = fs.createReadStream(false, { fd: fd });
						readStream.on('end', function() {
							// Close fd
							fs.close(fd);
						});
						resolve(readStream);
					}
				});
			}
		});
	});
};

StreamCache.prototype.set = function(identifier, stream) {
	var cachedObjectPath = this._getCachedObjectPath(identifier);
	var cacheFile = fs.createWriteStream(cachedObjectPath);

	stream.pipe(cacheFile);
};

StreamCache.prototype.writeThrough = function(identifier, stream) {
	var cachedObjectPath = this._getCachedObjectPath(identifier);

	var cacheStream = this.ready.then(function() {
		return fs.createWriteStream(cachedObjectPath);
	});

	return stream.pipe(through(function(chunk, enc, callback) {
		cacheStream.then(function(cache) {
			cache.write(chunk, enc);
		});

		this.push(chunk, enc);
		callback();
	}, function flush(callback) {
		cacheStream.then(function(stream) {
			stream.end();
			callback();
		});
	}));
};

StreamCache.prototype._getCachedObjectPath = function(identifier) {

	// resolving the identifier against the root filesystem directory prevents directory
	// traversal attacks
	return path.join(this.rootCacheDirectory, path.resolve('/', identifier));
};

module.exports = StreamCache;
