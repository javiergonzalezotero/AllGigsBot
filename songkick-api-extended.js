'use strict';
var Q = require('q') , request = require('request');
var Songkick = require('songkick-api');

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

Songkick.prototype.searchEventsWholeAnswer= function(params) {
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