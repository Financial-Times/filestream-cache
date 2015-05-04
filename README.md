# filestream-cache

Cache stream content transparently.

Why is this preferred to storing content in 'memory'?  Despite an 'in memory'
cache being very fast, the object must be stored as a Javascript `String`
which is subject to the memory manager of the runtime, it often doesn't make
sense to do memory management in our application when the operating system can
do a better job.

This method of caching defers the memory management to the operating system.
The content is cached by writing to the filesystem transparently and then
reading from it.  Frequently used items are then naturally cached by the operating
system's disk buffer cache.

## Usage

## API

TODO: (See JSDoc comments in `index.js`)

### Example

```JS
var Cache = require('filestream-cache');

// Create the cache providing a location on the filesystem to store the cached
// objects
var cache = new Cache('/tmp/myappcache');

// Get a cached object by the cache key.  If the object does not exist, create
// and cache it via the callback.
var stream = cache.get('cachekey', {}, function createStream() {
	return generateMyCacheableStream();
});

stream.pipe(process.stdout);
```


# License

MIT
