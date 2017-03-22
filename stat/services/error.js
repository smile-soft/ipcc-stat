(function(){

    'use strict';

    angular
        .module('app')
        .factory('errorService', errorService);

    errorService.$inject = [];

    function errorService(){

        return {
            show: show
        };

        function show(error){
            return console.error(error);
            // $translate('ERRORS.'+error)
            // .then(function (translation){
            //     if('ERRORS.'+error === translation) {
            //         notifications.showError('ERROR_OCCURRED');
            //     } else {
            //         notifications.showError(translation);
            //     }
            // });
        }

    }

})();