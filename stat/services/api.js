(function(){

    'use strict';

    angular
        .module('app')
        .factory('apiService', apiService);

    apiService.$inject = ['$http', 'appConfig', 'errorService'];

    function apiService($http, appConfig, errorService){

        var baseUrl = appConfig.server;

        return {
            getDbSettings: getDbSettings,
            getTasks: getTasks,
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
            var reqParams = {
                method: 'getQueryResultSet',
                params: {
                    query: ['SELECT', params.columns, 'FROM', params.tables, 'WHERE', 'processed.procid='+params.procid, 'and', params.tabrel, 'and timestart between', moment(params.begin).unix(), 'and', moment(params.end).unix(), (params.groupBy ? 'group by '+params.groupBy : '')].join(' ')
                }
            };
            return $http.post(baseUrl, reqParams);
        }

    }

})();