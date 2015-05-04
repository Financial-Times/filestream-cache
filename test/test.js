var StreamCache = require('../index');
var fs = require('fs');
var assert = require('assert');
var helpers = require('./testhelper');
var rmrf = require('rmrf');

describe("StreamCache", function() {

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
		it("should, if the cache key does not exist, create a new stream using the callback and cache it", function(done) {
			var streamContent = 'my test stream content';
			var testBucket = 'get#test-create';
			var cacheKey = 'test-key';

			var testDirectory = helpers.localTestDirectory(testBucket);

			var streamCache = new StreamCache(testDirectory);

			var cachedStream = streamCache.get(cacheKey, {}, function() {
				return helpers.createStream(streamContent);
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
	});
});
