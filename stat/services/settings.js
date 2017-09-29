(function(){

    'use strict';

    angular
        .module('app')
        .factory('SettingsService', SettingsService);

    SettingsService.$inject = ['$q', 'apiService', 'errorService'];

    function SettingsService($q, api, errorService){

        // var settings = null;
        var settings = {
            autoupdate: false,
            updateEvery: '1 minutes',
            kinds: [{name: 'Incoming_Agent', kind: 1}],
            kindsList: [{name: 'Incoming_Agent', kind: 1}, {name: 'Messaging_Chat', kind: 7}, {name: 'Autodial_Agent', kind: 129}, {name: 'Callback_Agent', kind: 257}],
            // kinds: [1, 7, 129],
            sl: [5, 10, 15, 20, 25, 30, 35, 40],
            db: {},
            tables: {},
            period: '1 day',
            catColours: []
            // catorder: 'catdesc' // changed during the dashboard initiation to the value from the config file
        };
        var fetched = false;

        return {
            getSettings: getSettings
        };
        
        // Get DB settings from cache or JSON file
        function getSettings() {
            return $q(function(resolve, reject) {
                if(fetched) return resolve(settings);

                api.getDbSettings()
                .then(function(dbSettings){
                    angular.extend(settings, dbSettings.data);
                    resolve(settings);
                    fetched = true;
                    
                }, function(err){
                    reject(err);
                });
            });
        }

    }

})();