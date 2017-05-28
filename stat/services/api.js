(function(){

    'use strict';

    angular
        .module('app')
        .factory('apiService', apiService);

    apiService.$inject = ['$http', 'appConfig', 'errorService', 'debugService'];

    function apiService($http, appConfig, errorService, debug){

        var baseUrl = appConfig.server;

        return {
            getDbSettings: getDbSettings,
            getTasks: getTasks,
            getFCRStatistics: getFCRStatistics,
            getCustomFCRStatistics: getCustomFCRStatistics,
            getTaskGroupStatistics: getTaskGroupStatistics,
            getCustomListStatistics: getCustomListStatistics,
            getQueryResultSet: getQueryResultSet

        };

        function getDbSettings() {
            return $http.get('/stat/db.json');
        }

        function getTasks(params, cb) {
            var reqParams = {
                method: 'getTasks',
                params: params
            };
            return $http.post(baseUrl, reqParams);
        }

        function getFCRStatistics(params, cb) {
            var reqParams = {
                method: 'getFCRStatistics',
                params: params
            };
            return $http.post(baseUrl, reqParams);
        }

        function getCustomFCRStatistics(params, cb) {
            var reqParams = {
                method: 'getCustomFCRStatistics',
                params: params
            };
            return $http.post(baseUrl, reqParams);   
        }

        function getTaskGroupStatistics(params) {
            var reqParams = {
                method: 'getTaskGroupStatistics',
                params: params
            };
            return $http.post(baseUrl, reqParams);
        }

        function getCustomListStatistics(params) {
            var reqParams = {
                method: 'getCustomListStatistics',
                params: params
            };
            return $http.post(baseUrl, reqParams);
        }

        function getQueryResultSet(params) {
            var SELECT = 'SELECT ' + params.columns;
            var FROM = 'FROM ' + params.tables;
            var WHERE = (params.tabrel || params.begin) ? 'WHERE ' : '';
            var GROUPBY = params.groupBy ? ('GROUP BY ' + params.groupBy) : '';

            WHERE += params.tabrel ? params.tabrel : '';
            WHERE += params.begin ? 
                    ( (WHERE ? ' and ' : '') + 'timestart between ' + moment(params.begin).unix() + ' and ' + moment(params.end).unix() ) : '';

            var reqParams = {
                method: 'getQueryResultSet',
                params: {
                    query: [SELECT, FROM, WHERE, GROUPBY].join(' ')
                    // query: ['SELECT', params.columns, 'FROM', params.tables, 'WHERE', 'processed.procid='+params.procid, 'and', params.tabrel, 'and timestart between', moment(params.begin).unix(), 'and', moment(params.end).unix(), (params.groupBy ? 'group by '+params.groupBy : '')].join(' ')
                }
            };
            return $http.post(baseUrl, reqParams);
        }

    }

})();