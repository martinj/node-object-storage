# node-object-storage

node client library for [Openstack Object Storage](http://www.openstack.org/software/openstack-storage/)

[![Build Status](https://secure.travis-ci.org/martinj/node-object-storage.png)](http://travis-ci.org/martinj/node-object-storage)

## Installation

	npm install object-storage

## Example

	var ObjectStorage = require('object-storage'),
		storage = new ObjectStorage({
			host: '',
			username: '',
			password: ''
		});

	storage.create('mycontainer').then(function() {
		storage.putFile({src: 'path/to/file.jpg', dst: 'mycontainer/file.jpg'}).then(function(url) {
			console.log('Object storage url to file', url);
		});
	});


See object-storage.test.js for more examples.

## Run Tests

	npm test

## Enable debugging output

Set DEBUG environment variable to object-storage

	DEBUG=object-storage node ./app.js
