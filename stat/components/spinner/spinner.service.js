(function(){

    'use strict';

    angular
        .module('app')
        .factory('spinnerService', spinnerService);

    function spinnerService(){

        var spinners = {};
        
        return {
            _register: function (data) {
                if (!data.hasOwnProperty('name')) {
                    return console.log("Spinner must specify a name when registering with the spinner service.");
                }
                // if (spinners.hasOwnProperty(data.name)) {
                //     return console.log("A spinner with the name '" + data.name + "' has already been registered.");
                // }
                spinners[data.name] = data;
            },
            show: function (name) {
                var spinner = spinners[name];
                if (!spinner) return console.log("No spinner named '" + name + "' is registered.");
                spinner.show();
            },
            hide: function (name) {
                var spinner = spinners[name];
                if (!spinner) return console.log("No spinner named '" + name + "' is registered.");
                spinner.hide();
            },
            showAll: function () {
                for (var name in spinners) {
                    spinners[name].show();
                }
            },
            hideAll: function () {
                for (var name in spinners) {
                    spinners[name].hide();
                }
            }
        };

    }

})();