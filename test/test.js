var StreamCache = require('../index');
var fs = require('fs');
var assert = require('assert');
var helpers = require('./testhelper');

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
			var stream = helpers.createStream('my test stream content');
			var testBucket = 'writeThrough#test';

			var streamCache = new StreamCache(helpers.localTestDirectory(testBucket));
			var cachedStream = streamCache.writeThrough('test-key', stream);
			stream.end();
			var streamBuffer = "";

			cachedStream.on('data', function(data) {
				streamBuffer += data.toString();
			});

			cachedStream.on('end', function() {
				assert.equal("my test stream content", streamBuffer);
				done();
			});
		});
	});


});
