'use strict';
var Promise = require('bluebird'),
	request = require('request'),
	ObjectStorageRequest = require('./object-storage-request'),
	querystring = require('querystring');

function slash(path) {
	return (path[0] === '/') ? path : '/' + path;
}
/**
 * Create an instance of ObjectStorage
 * @param {Object} opts Options
 * @param {String} opts.host
 * @param {String} opts.username
 * @param {String} opts.password
 * @param {Number} [opts.timeout] - connect timeout for requests, default 30 sec
 */
function ObjectStorage(opts) {
	this.host = opts.host;
	this.username = opts.username;
	this.password = opts.password;
	this.authToken = null;
	this.storageUrl = null;
	this.timeout = opts.timeout || 30000;
}

/**
 * Request new accessToken
 * @return {Promise} Resolves with [storageUrl, authToken]
 * @api private
 */
ObjectStorage.prototype.refreshToken = function () {
	var dfd = Promise.defer(),
		self = this,
		opts = {
			url: this.host,
			method: 'GET',
			headers: {
				'Accept': 'application/json',
				'X-Auth-User': this.username,
				'X-Auth-Key': this.password
			},
			timeout: this.timeout
		};

	request(opts, function (err, res) {
		if (err || res.statusCode !== 200) {
			return dfd.reject(err || new Error(res.text));
		}

		self.storageUrl = res.headers['x-storage-url'];
		self.authToken = res.headers['x-auth-token'];
		dfd.resolve([self.storageUrl, self.authToken]);
	});

	return dfd.promise;
};

/**
 * Create new ObjectStorageRequest instance and fetch storage url
 * @return {Promise} resolves with [ObjectStorageRequest, url]
 * @api private
 */
ObjectStorage.prototype.request = function () {
	var self = this;
	return this.getUrl().then(function (url) {
		return [new ObjectStorageRequest(self, { timeout: self.timeout }), url];
	});
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

	return this.request().spread(function (req, url) {
		return req.head(url + slash(path))
			.set(headers)
			.end()
			.then(function (res) {
				return res.headers;
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
	return this.request().spread(function (req, url) {
		return req.post(url + slash(path))
			.set(headers)
			.end()
			.then(function (res) {
				return res.headers;
			});
	});
};

/**
 * Delete object
 * @param  {String} path full path to the object to delete
 * @return {Promise}      Containing response object on resolve.
 */
ObjectStorage.prototype.deleteFile = function (path) {
	return this.request().spread(function (req, url) {
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
	return this.request().spread(function (req, url) {
		req.put(url + slash(opts.dst))
			.attach(opts.src);

		if (opts.headers) {
			req.set(opts.headers);
		}
		return req.end().then(function () {
			return url + slash(opts.dst);
		});
	});
};

/**
 * Create container
 * @param  {String} container
 * @return {Promise}
 */
ObjectStorage.prototype.create = function (container) {
	return this.request().spread(function (req, url) {
		return req.put(url + slash(container)).end().then(function () {
			return Promise.resolve();
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
	return this.request().spread(function (req, url) {
		return req.put(url + slash(dstObj))
			.set('X-Copy-From', slash(srcObj))
			.set('Content-Length', 0)
			.end().then(function () {
				return Promise.resolve();
			});
	});
};

/**
 * List
 * @param  {String} [container] Container or path, if omitted it will list containers
 * @param {Object} [opts] Options of Openstack Object Storage list API, see http://docs.openstack.org/api/openstack-object-storage/1.0/content/GET_showContainerDetails_v1__account___container__storage_container_services.html
 * @return {Promise}	Resolves with response body
 */
ObjectStorage.prototype.list = function (container, opts) {
	if (typeof container === 'object') {
		// when container is omitted but opts is given
		opts = container;
		container = '';
	}
	container = container || '';
	var optString = opts ? '?' + querystring.stringify(opts) : '';

	return this.request().spread(function (req, url) {
		return req.get(url + slash(container) + optString)
			.end().then(function (res) {
				if (/^application\/json($|;)/.test(res.headers['content-type'])) {
					return JSON.parse(res.body);
				}
				return res.body;
			});
	});
};

/**
 * Get storage url
 * @return {Promise} Resolves with storage url
 */
ObjectStorage.prototype.getUrl = function () {
	if (this.storageUrl) {
		return Promise.resolve(this.storageUrl);
	}

	return this.refreshToken().spread(function (url) {
		return url;
	});
};

module.exports = ObjectStorage;
