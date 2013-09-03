'use strict';
var ObjectStorage = require('../lib/object-storage'),
	nock = require('nock');
require('should');

describe('Object Storage', function () {
	beforeEach(function () {
		var conf = {
			url: 'https://objectstorage.net',
			basePath: '/auth/v1.0/'
		};

		this.store = new ObjectStorage({
			host: conf.url + conf.basePath,
			username: 'user',
			password: 'pass'
		});

		this.storageUrl = 'http://storageUrl';
		nock(conf.url)
			.get(conf.basePath)
			.reply(200, '', { 'X-STORAGE-URL': this.storageUrl, 'X-AUTH-TOKEN': 'token' });
	});

	afterEach(function () {
		nock.cleanAll();
	});

	describe('Authentication', function () {
		it('authenticates if no tokens exists', function (done) {
			var self = this;
			this.store.refreshToken().then(function () {
				self.store.authToken.should.equal('token');
				self.store.storageUrl.should.equal('http://storageUrl');
				done();
			}).done();
		});

		it('should refresh token on 401 response', function (done) {
			nock(this.storageUrl)
				.matchHeader('X-AUTH-TOKEN', 'esfdsdf')
				.get('/foo')
				.reply(401, '');

			nock(this.storageUrl)
				.matchHeader('X-AUTH-TOKEN', 'token')
				.get('/foo')
				.reply(200, '');

			var self = this;
			this.store.storageUrl = this.storageUrl;
			this.store.authToken = 'esfdsdf';
			this.store.list('foo').then(function () {
				self.store.authToken.should.equal('token');
				done();
			}).done();
		});
	});

	describe('#create', function () {
		it('should create container', function (done) {
			nock(this.storageUrl)
				.put('/foo')
				.reply(200);
			this.store.create('foo').then(function () {
				done();
			}).done();
		});
	});

	describe('#list', function () {
		it('should receive list of containers when no container specified', function (done) {
			nock(this.storageUrl)
				.get('/')
				.reply(200, ['1'], { 'Content-Type': 'application/json' });

			this.store.list().then(function (containers) {
				containers.length.should.be.above(0);
				done();
			}).done();
		});

		it('should return list of items when container specified', function (done) {
			nock(this.storageUrl)
				.get('/foo')
				.reply(200, ['1'], { 'Content-Type': 'application/json' });

			this.store.list('foo').then(function (items) {
				items.should.not.be.empty;
				done();
			}).done();
		});
	});

	describe('#putFile', function () {
		it('should upload file and returns its url', function (done) {
			var opts = {
				src: __dirname + '/object-storage.test.js',
				dst: 'foo/small.jpg',
				headers: {
					'Content-Type': 'image/jpeg'
				}
			};

			nock(this.storageUrl)
				.put('/foo/small.jpg')
				.reply(201);

			this.store.putFile(opts).then(function (url) {
				url.should.equal('http://storageUrl/foo/small.jpg');
				done();
			}).done();
		});
	});

	describe('#deleteFile', function () {
		it('should delete file', function (done) {
			nock(this.storageUrl)
				.delete('/foo/deleteme.jpg')
				.reply(201);

			this.store.deleteFile('foo/deleteme.jpg').then(function () {
				done();
			}).done();
		});
	});

	describe('#getMeta', function () {
		it('should return meta on account if no path is specified', function (done) {
			nock(this.storageUrl)
				.head('/')
				.reply(200, '', { 'x-account-object-count': 1 });

			this.store.getMeta().then(function (meta) {
				meta.should.have.property('x-account-object-count');
				done();
			}).done();
		});

		it('should return meta on container and use customer headers', function (done) {
			nock(this.storageUrl)
				.matchHeader('X-Context', 'cdn')
				.head('/foo')
				.reply(200, '', { 'x-container-object-count': 1, 'x-cdn-url': 'foo' });

			this.store.getMeta('foo', { 'X-Context': 'cdn' }).then(function (meta) {
				meta.should.have.property('x-container-object-count');
				meta.should.have.property('x-cdn-url');
				done();
			}).done();
		});

		it('should return meta on object', function (done) {
			nock(this.storageUrl)
				.head('/foo/small.jpg')
				.reply(200, '', { 'content-length': 1 });

			this.store.getMeta('foo/small.jpg').then(function (meta) {
				meta.should.have.property('content-length');
				done();
			}).done();
		});
	});
});