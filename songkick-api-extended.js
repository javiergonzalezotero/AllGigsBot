'use strict';
var Q = require('q') , request = require('request');
var Songkick = require('songkick-api');
var redis = require('redis');

function makeWholeRequest(url, resultType) {
	var deferred = Q.defer();
	console.log(url);
	request.get(url, function(error, response, body) {
		body = JSON.parse(body);
		if (body.resultsPage.status === 'error') {
			deferred.reject(body.resultsPage.error);
		}
		deferred.resolve(body.resultsPage);
	});
	return deferred.promise;
}


function makeRequest(url, resultType) {
	var deferred = Q.defer();
	console.log(url);
	request.get(url, function(error, response, body) {
		body = JSON.parse(body);
		if (body.resultsPage.status === 'error') {
			deferred.reject(body.resultsPage.error);
		}
		deferred.resolve(body.resultsPage.results[resultType]);
	});
	return deferred.promise;
}

function searchCache(uri, resultType, fullResponse) {
	console.log("searchCache")
	var key = 's:' + uri;
	var r = redis.createClient(process.env.REDIS_URL);
	var deferred = Q.defer();
	console.log(key);
	r.on('connect', function () {
		r.get(key, function (err, reply) {
			if (!err && reply) {
				console.log("cache hit")
				deferred.resolve(JSON.parse(reply));
			} else {
				console.log("cache miss");
				request.get(uri, function(error, response, body) {
					body = JSON.parse(body);
					if (body.resultsPage.status === 'error') {
						deferred.reject(body.resultsPage.error);
					}
					var result = fullResponse ? body.resultsPage : body.resultsPage.results[resultType];
					r.set(key, JSON.stringify(result), function(err, reply){
						redis.print();
						r.quit();
					});
					r.expire(key, 172800/*2 days*/);
					deferred.resolve(result);
				});
			}
		});
	});

	r.on("error", function (err) {
		console.log("error redis")
		request.get(uri, function(error, response, body) {
			body = JSON.parse(body);
			if (body.resultsPage.status === 'error') {
				deferred.reject(body.resultsPage.error);
			}
			var result = fullResponse ? body.resultsPage : body.resultsPage.results[resultType];
			deferred.resolve(result);
		});
	});
	return deferred.promise;
};

/*Songkick.prototype.searchEventsWholeAnswer= function(params, fullResponse) {
	if (!(params.location || params.artist_name)) {
		throw '{location} OR {artist_name} must be include in the parameters you pass in';
	}
	if ((params.min_date || params.max_date) && !(params.min_date && params.max_date)) {
		throw 'If pass in {min_date} OR {max_data} as parameters, you must include both';
	}
	var endPoint = '/events';
	var allowedParams = ['artist_name', 'location', 'min_date', 'max_date', 'page', 'per_page'];
	var url = this.buildUrl(endPoint, params, allowedParams);
	return makeWholeRequest(url, 'event');
	return searchCache(url, 'event', fullResponse);
};*/

Songkick.prototype.searchEventsCache= function(params, fullResponse) {
	if (!(params.location || params.artist_name)) {
		throw '{location} OR {artist_name} must be include in the parameters you pass in';
	}
	if ((params.min_date || params.max_date) && !(params.min_date && params.max_date)) {
		throw 'If pass in {min_date} OR {max_data} as parameters, you must include both';
	}
	var endPoint = '/events';
	var allowedParams = ['artist_name', 'location', 'min_date', 'max_date', 'page', 'per_page'];
	var url = this.buildUrl(endPoint, params, allowedParams);
	return searchCache(url, 'event', fullResponse);
};


Songkick.prototype.searchPerformances= function(params) {
	if (!params.artist_id) {
		throw '{artist_id} must be include in the parameters you pass in';
	}
	if ((params.min_date || params.max_date) && !(params.min_date && params.max_date)) {
		throw 'If pass in {min_date} OR {max_data} as parameters, you must include both';
	}
	var endPoint = '/artists/' + params.artist_id + '/calendar/performances';
	var allowedParams = ['min_date', 'max_date', 'page', 'per_page'];
	var url = this.buildUrl(endPoint, params, allowedParams);
	return makeRequest(url, 'performance');
};



module.exports = Songkick;