(function(){

    'use strict';

    angular
        .module('app')
        .factory('SettingsService', SettingsService);

    SettingsService.$inject = ['$q', 'apiService', 'errorService'];

    function SettingsService($q, api, errorService){

        var settings = null;

        return {
            getSettings: getSettings
        };
        
        // Get DB settings from cache or JSON file
        function getSettings() {
            return $q(function(resolve, reject) {
                if(settings) {
                    resolve(settings);
                    return;
                }

                api.getDbSettings()
                .then(function(dbSettings){
                    settings = dbSettings.data;
                    resolve(settings);
                }, function(err){
                    reject(err);
                });
            });
        }

    }

})();