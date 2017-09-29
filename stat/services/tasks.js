(function(){

    'use strict';

    angular
        .module('app')
        .factory('TasksService', TasksService);

    TasksService.$inject = ['$q', 'apiService', 'errorService'];

    function TasksService($q, api, errorService){

        var tasks = {};

        return {
            getTasks: getTasks,
            getTaskList: getTaskList
        };
        
        function getTasks(kinds) {
            return $q(function(resolve, reject) {

                if(Object.keys(tasks).length) return resolve(tasks);

                kinds.forEach(function(item, index, array) {
                    api.getTasks({ kind: item.kind })
                    .then(function(response) {
                        tasks[item.name] = response.data.result;
                        if(index === array.length-1) resolve(tasks);
                    })
                    .catch(function(err) { reject(err); });
                });
            });
        }

        function getTaskList(id) {
            return api.getTasks({ kind: id });
        }
    }

})();