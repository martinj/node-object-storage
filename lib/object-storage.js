'use strict';
var Q = require('q'),
	request = require('superagent'),
	ObjectStorageRequest = require('./object-storage-request'),
	joinPath = require('path').join;

function slash(path) {
	return joinPath('/', path);
}
/**
 * Create an instance of ObjectStorage
 * @param opts Options
 * @param opts.host
 * @param opts.username
 * @param opts.password
 */
function ObjectStorage(opts) {
	this.host = opts.host;
	this.username = opts.username;
	this.password = opts.password;
	this.authToken = null;
	this.storageUrl = null;
}

/**
 * Request new accessToken
 * @return {Promise} Resolves with [storageUrl, authToken]
 * @api private
 */
ObjectStorage.prototype.refreshToken = function () {
	var dfd = Q.defer(),
		self = this;
	request
		.get(this.host)
		.set('Accept', 'application/json')
		.set('X-Auth-User', this.username)
		.set('X-Auth-Key', this.password)
		.end(function (err, res) {
			if (err || !res.ok) {
				return dfd.reject(err || new Error(res.text));
			}

			self.storageUrl = res.header['x-storage-url'];
			self.authToken = res.header['x-auth-token'];
			dfd.resolve([self.storageUrl, self.authToken]);
		});
	return dfd.promise;
};

/**
 * Request meta on account/container/object
 * @param  {String} [path]	if omitted it will request meta on account
 * @param  {Object} [headers] optional headers
 * @return {Promise}	Resolves with response headers
 */
ObjectStorage.prototype.getMeta = function (path, headers) {
	headers = headers || {};
	path = path || '';

	var req = new ObjectStorageRequest(this);
	return this.getUrl().then(function (url) {
		return req.head(url + slash(path))
			.set(headers)
			.end()
			.then(function (res) {
				return Q.resolve(res.headers);
			});
	});
};

/**
 * Set meta on container/object
 * @param  {String} path
 * @param  {Object} headers
 * @return {Promise}	Resolves with response headers
 */
ObjectStorage.prototype.setMeta = function (path, headers) {
	var req = new ObjectStorageRequest(this);
	return this.getUrl().then(function (url) {
		return req.post(url + slash(path))
			.set(headers)
			.end()
			.then(function (res) {
				return Q.resolve(res.headers);
			});
	});
};

/**
 * Delete object
 * @param  {String} path full path to the object to delete
 * @return {Promise}      Containing response object on resolve.
 */
ObjectStorage.prototype.deleteFile = function (path) {
	var req = new ObjectStorageRequest(this);

	return this.getUrl().then(function (url) {
		req.delete(url + slash(path));
		return req.end();
	});
};

/**
 * Put file
 * @param  opts Options
 * @param opts.dst Destination path
 * @param opts.src Src file
 * @return {Promise}	Resolves with the url to the object
 */
ObjectStorage.prototype.putFile = function (opts) {
	var req = new ObjectStorageRequest(this);

	return this.getUrl().then(function (url) {
		req.put(url + slash(opts.dst))
			.attach(opts.src);

		if (opts.headers) {
			req.set(opts.headers);
		}
		return req.end().then(function () {
			return Q.resolve(url + slash(opts.dst));
		});
	});
};

/**
 * Create container
 * @param  {String} container
 * @return {Promise}
 */
ObjectStorage.prototype.create = function (container) {
	var req = new ObjectStorageRequest(this);
	return this.getUrl().then(function (url) {
		return req.put(url + slash(container)).end().then(function () {
			return Q.resolve();
		});
	});
};

/**
 * Copy object
 * @param  {String} srcObj
 * @param {String} dstObj
 * @return {Promise}
 */
ObjectStorage.prototype.copy = function (srcObj, dstObj) {
	var req = new ObjectStorageRequest(this);
	return this.getUrl().then(function (url) {
		return req.put(url + slash(dstObj))
			.set('X-Copy-From', slash(srcObj))
			.set('Content-Length', 0)
			.end().then(function () {
				return Q.resolve();
			});
	});
};

/**
 * List
 * @param  {String} [container] Container or path, if omitted it will list containers
 * @return {Promise}	Resolves with response body
 */
ObjectStorage.prototype.list = function (container) {
	container = container || '';

	var req = new ObjectStorageRequest(this);
	return this.getUrl().then(function (url) {
		return req.get(url + slash(container))
			.end().then(function (res) {
				return Q.resolve(res.body);
			});
	});
};

/**
 * Get storage url
 * @return {Promise} Resolves with storage url
 */
ObjectStorage.prototype.getUrl = function () {
	if (this.storageUrl) {
		return Q.resolve(this.storageUrl);
	}

	return this.refreshToken().spread(function (url) {
		return Q.resolve(url);
	});
};

module.exports = ObjectStorage;