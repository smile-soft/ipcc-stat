(function(){

    'use strict';

    angular
        .module('app')
        .factory('TasksService', TasksService);

    TasksService.$inject = ['apiService', 'errorService'];

    function TasksService(api, errorService){

        var tasks = [
            {name: 'Incoming_Agent', kind: 1},
            {name: 'Messaging_Chat', kind: 7},
            {name: 'Autodial_Agent', kind: 129}
        ];

        return {
            getTasks: getTasks,
            getTaskList: getTaskList
        };
        
        function getTasks() {
            return tasks;
        }

        function getTaskList(id) {
            return api.getTasks({ kind: id });
        }
    }

})();