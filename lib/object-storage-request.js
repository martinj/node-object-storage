'use strict';
var Q = require('q'),
	fs = require('fs'),
	request = require('superagent'),
	debug = require('debug')('object-storage');

/**
 * Create ObjectStorageRequest instanct
 * @param {ObjectStorage} objectstorage
 * @api private
 */
function ObjectStorageRequest(objectstorage) {
	this.objectstorage = objectstorage;
	this.retries = 0;
	this.method = '';
	this.attachment = false;
	this.headers = {};
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
	var dfd = Q.defer(),
		self = this,
		req = request(this.method, this.url).set(this.getHeaders());

	var handleResponse = function (err, res) {
		debug(self.method, self.url, res ? res.statusCode : '', self.getHeaders());
		if (err) {
			return dfd.reject(err);
		}
		if (!res.ok) {
			if (res.statusCode === 401 && self.retries === 0) {
				self.retries = 1;
				self.objectstorage.refreshToken().then(function () {
					return self.end();
				}).then(function (res) {
					dfd.resolve(res);
				}).fail(function (err) {
					dfd.reject(err);
				});
				return;
			}
			return dfd.reject(new Error(res.text));
		}

		dfd.resolve(res);
	};

	if (this.attachment) {
		var stream = fs.createReadStream(this.attachment);
		stream.pipe(req);
	}
	req.end(handleResponse);

	return dfd.promise;
};

module.exports = ObjectStorageRequest;
