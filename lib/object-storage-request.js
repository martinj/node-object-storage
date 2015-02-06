'use strict';
var Promise = require('bluebird'),
	fs = require('fs'),
	printf = require('util').format,
	request = require('request'),
	debug = require('debug')('object-storage');

/**
 * Create ObjectStorageRequest instanct
 * @param {ObjectStorage} objectstorage
 * @param {Object} [opts]
 * @param {Number} [opts.timeout] connect timeout for request
 * @api private
 */
function ObjectStorageRequest(objectstorage, opts) {
	opts = opts || {};
	this.objectstorage = objectstorage;
	this.retries = 0;
	this.method = '';
	this.attachment = false;
	this.headers = {};
	this.timeout = opts.timeout || 30000;
}

ObjectStorageRequest.prototype.get = function (url) {
	this.method = 'GET';
	this.url = url;
	return this;
};

ObjectStorageRequest.prototype.put = function (url) {
	this.method = 'PUT';
	this.url = url;
	return this;
};

ObjectStorageRequest.prototype.delete = function (url) {
	this.method = 'DELETE';
	this.url = url;
	return this;
};

ObjectStorageRequest.prototype.post = function (url) {
	this.method = 'PUT';
	this.url = url;
	return this;
};

ObjectStorageRequest.prototype.head = function (url) {
	this.method = 'HEAD';
	this.url = url;
	return this;
};

ObjectStorageRequest.prototype.getHeaders = function () {
	var headers = this.headers;
	headers['X-Auth-Token'] = this.objectstorage.authToken;
	headers['Accept'] = 'application/json';
	return headers;
};

ObjectStorageRequest.prototype.set = function (key, val) {
	if (typeof key === 'object') {
		var self = this;
		Object.keys(key).forEach(function (k) {
			self.headers[k] = key[k];
		});
		return this;
	}

	this.headers[key] = val;
	return this;
};

ObjectStorageRequest.prototype.attach = function (file) {
	this.attachment = file;
	return this;
};

ObjectStorageRequest.prototype.end = function () {
	var dfd = Promise.defer(),
		self = this,
		opts = {
			method: this.method,
			url: this.url,
			headers: this.getHeaders(),
			timeout: this.timeout
		};

	var handleResponse = function (err, res) {
		debug(self.method, self.url, res ? res.statusCode : '', self.getHeaders());
		if (err) {
			return dfd.reject(err);
		}

		var ok = (res.statusCode / 100 | 0) === 2;

		if (!ok) {
			if (res.statusCode === 401 && self.retries === 0) {
				self.retries = 1;
				self.objectstorage.refreshToken().then(function () {
					return self.end();
				}).then(function (res) {
					dfd.resolve(res);
				}).catch(function (err) {
					dfd.reject(err);
				});
				return;
			}
			return dfd.reject(new Error(printf(
				'%s %s responded with statusCode: %s, body: %s',
				self.method.toUpperCase(),
				self.url,
				res.statusCode,
				res.text || ''
			)));
		}

		dfd.resolve(res);
	};

	if (this.attachment) {
		fs.createReadStream(this.attachment).on('error', function (err) {
			dfd.reject(err);
		}).pipe(request(opts, handleResponse));
	} else {
		request(opts, handleResponse);
	}

	return dfd.promise;
};

module.exports = ObjectStorageRequest;
