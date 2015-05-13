var StreamCache = require('../index'); var fs = require('fs');
var assert = require('assert');
var helpers = require('./testhelper');
var rmrf = require('rmrf');

describe("StreamCache", function() {

	describe("#isStale(identifier)", function() {
		it("should return true, if the cache object is stale", function(done) {
			helpers.testIsStale(-1, true, done);
		});

		it("should return false, if the cache object is not stale", function(done) {
			helpers.testIsStale(4000, false, done);
		});

	});

	describe("#purge(callback)", function() {
		it("should purge any objects from the cache where the Promise returned from the callback resolves as true", function(done) {
			helpers.testPurgeFunction(['a', 'b', 'c', 'd', 'e'], ['d', 'e'], function(cacheKey) {
				return Promise.resolve(cacheKey === 'a' || cacheKey === 'b' || cacheKey === 'd');
			}).then(function() { done(); }).catch(function(e) { done(e); });
		});

		it("should purge any objects from the cache where the cache key matches 'true' against the callback function", function(done) {
			helpers.testPurgeFunction(['a', 'b', 'c', 'd', 'e'], ['d', 'e'], function(cacheKey) {
				return cacheKey === 'a' || cacheKey === 'b' || cacheKey === 'd';
			}).then(function() { done(); }).catch(function(e) { done(e); });
		});
	});

	describe("#writeThrough(identifier, stream)", function() {
		it("should not cache an erroring stream", function(done) {
			var testBucket = 'writeThrough#error';
			var cacheKey = 'test';

			var stream = helpers.createErroringStream("test content");
			var testDirectory = helpers.localTestDirectory(testBucket);

			var streamCache = new StreamCache(testDirectory);
			var cachedStream = streamCache.writeThrough(cacheKey, stream);

			cachedStream.on('error', function(err) {
				assert.equal(err.message, 'fail');
				var cachedObjectPromise = streamCache._read(cacheKey);

				cachedObjectPromise.then(function(object) {
					assert.equal(object, false);

					rmrf(testDirectory);
					done();
				});
			});
		});

		it("should write the stream to the cache and return the stream without modification", function(done) {
			var streamContent = 'my test stream content';
			var testBucket = 'writeThrough#test';
			var cacheKey = 'test-key';

			var stream = helpers.createStream(streamContent);
			var testDirectory = helpers.localTestDirectory(testBucket);

			var streamCache = new StreamCache(testDirectory);
			var cachedStream = streamCache.writeThrough(cacheKey, stream);
			stream.end();
			var streamBuffer = "";

			cachedStream.on('data', function(data) {
				streamBuffer += data.toString();
			});

			cachedStream.on('end', function() {
				assert.equal(streamContent, streamBuffer);
				// Read the contents of the cached object on disk:
				var path = streamCache._getCachedObjectPath(cacheKey);
				fs.readFile(path, function(e, fileContents) {

					assert.equal(streamContent, fileContents.toString());
					rmrf(testDirectory);
					done();
				});
			});

			cachedStream.on('error', function(e) {
				rmrf(testDirectory);
				done(e || new Error("Stream fired 'error' event without error argument"));
			});
		});
	});

	describe("#get(identifier, options, callback)", function() {

		it("should, if the cached object's age is older than the default ttl, create a new stream and overwrite the cache", function(done) {
			var streamContent = 'my test stream content';
			var testBucket = 'get#test-create-stale';
			var cacheKey = 'testkey';

			var testDirectory = helpers.localTestDirectory(testBucket);
			var streamCache = new StreamCache(testDirectory, { defaultTtl: -1 });

			var streamCreateCount = 0;

			var cachedStream = streamCache.get(cacheKey, {}, function() {
				streamCreateCount++;
				return helpers.createStream(streamContent + " - first create").end();
			});

			cachedStream.on('data', function() { /* do nothing */ });
			cachedStream.on('error', function(e) { rmrf(testDirectory); done(e); });
			cachedStream.on('end', function()  { next(); });

			function next() {
				var content = streamContent + " - second create";
				var freshStream = streamCache.get(cacheKey, {}, function() {
					streamCreateCount++;
					return helpers.createStream(content).end();
				});

				var bufferedContent = "";

				freshStream.on('data', function(data) {
					bufferedContent += data.toString();
				});
				freshStream.on('error', function(e) { rmrf(testDirectory); done(e); });

				freshStream.on('end', function() {
					rmrf(testDirectory);
					assert.equal(streamCreateCount, 2);
					assert.equal(bufferedContent, content);
					done();
				});
			}
		});

		it("should, if the cache key does not exist, create a new stream using the callback and cache it", function(done) {
			var streamContent = 'my test stream content';
			var testBucket = 'get#test-create';
			var cacheKey = 'test-key';

			var testDirectory = helpers.localTestDirectory(testBucket);

			var streamCache = new StreamCache(testDirectory);

			var cachedStream = streamCache.get(cacheKey, {}, function() {
				return helpers.createStream(streamContent).end();
			});

			var streamBuffer = "";
			cachedStream.on('data', function(data) {
				streamBuffer += data.toString();
			});

			cachedStream.on('end', function() {
				assert.equal(streamContent, streamBuffer);
				var path = streamCache._getCachedObjectPath(cacheKey);
				fs.readFile(path, function(e, fileContents) {
					if (e) { done(e); return; }

					assert.equal(streamContent, fileContents.toString());
					rmrf(testDirectory);
					done();
				});
			});

			cachedStream.on('error', function(e) {
				rmrf(testDirectory);
				done(e || new Error("Stream fired 'error' event without error argument"));
			});
		});

		it("should, if the cache key does exist, return the cached object", function(done) {
			var streamContent = 'my test stream content';
			var testBucket = 'get#test-read';
			var cacheKey = 'test-key';

			var testDirectory = helpers.localTestDirectory(testBucket);

			var streamCache = new StreamCache(testDirectory);
			var objectOnDisk = streamCache._getCachedObjectPath(cacheKey);

			fs.writeFile(objectOnDisk, streamContent, function(err) {
				if (err) { done(err); return; }

				var stream = streamCache.get(cacheKey, {}, function() {
					done(new Error("Should've picked up the cached object rather than creating a new one"));
				});

				var streamBuffer = "";

				stream.on('data', function(data) {
					streamBuffer += data.toString();
				});

				stream.on('end', function() {
					assert.equal(streamContent, streamBuffer);
					rmrf(testDirectory);
					done();
				});

				stream.on('error', function(e) {
					rmrf(testDirectory);
					done(e || new Error("Stream fired 'error' event without error argument"));
				});
			});
		});
	});
});
