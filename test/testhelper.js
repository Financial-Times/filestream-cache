'use strict';
var path = require('path');
var mkdirp = require('mkdirp');
var fs = require('fs');
var resumer = require('resumer');
var rmrf = require('rmrf');
var StreamCache = require('../index');

function localTestDirectory(bucket) {
	return path.join(__dirname, '/tmp/', bucket);
};
function createCacheObjects(bucket, objectNames) {
	var localDirectory = localTestDirectory(bucket);

	var directoryPromise = new Promise(function(resolve, reject) {
		mkdirp(localDirectory, function(e, ok) {
			if (e) { reject(); } else { resolve(); }
		});
	});

	return directoryPromise.then(function() {
		return Promise.all(objectNames.map(function(name) {
			return new Promise(function(resolve, reject) {
				var writeStream = fs.createWriteStream(path.join(localDirectory, name));
				writeStream.end("Some Test Content");
				resolve(true);
			});
		}));
	});
}

function createStream(streamContents) {
	var stream = resumer();
	stream.queue(streamContents);
	return stream;
}

function testPurgeFunction(cacheKeys, expected, filterFunction) {
	// Add some uniqueness with Date.now()
	var bucket = "purge#promisefilter-" + (Date.now() * Math.random());
	var testDirectory = localTestDirectory(bucket);

	return createCacheObjects(bucket, cacheKeys).then(function() {
		var streamCache = new StreamCache(testDirectory);
		streamCache.purge(filterFunction).then(function() {
			return new Promise(function(resolve, reject) {
				fs.readdir(testDirectory, function(e, files) {
					assert.deepEqual(expected, files);
					resolve();
				});
			});
		});
	}).catch(function(e) {
		rmrf(testDirectory);
		throw e;
	}).then(function() {
		rmrf(testDirectory);
		return;
	});
}

module.exports = {
	localTestDirectory: localTestDirectory,
	createCacheObjects: createCacheObjects,
	testPurgeFunction: testPurgeFunction,
	createStream: createStream
};
