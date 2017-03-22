(function(){

    'use strict';

    angular
        .module('app')
        .factory('debugService', debugService);

    debugService.$inject = ['$log', 'store', 'errorService'];

    function debugService($log, store, errorService){

        return {
            log: function(message){ log(arguments, 'log'); },
            info: function(message){ log(arguments, 'info'); },
            warn: function(message){ log(arguments, 'warn'); },
            error: errorService.show
        };

        function log(args, method){
            if(store.get('debug')) {
                [].forEach.call(args, function(arg){
                    $log[method](arg);
                });
                return;
            }
        }

    }

})();