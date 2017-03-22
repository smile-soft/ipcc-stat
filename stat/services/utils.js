(function(){

    'use strict';

    angular
        .module('app')
        .factory('utilsService', utilsService);

    // utilsService.$inject = [];

    function utilsService(){

        return {
            getTotals: getTotals,
            setPercentageValues: setPercentageValues,
            getAbandonmentRate: getAbandonmentRate,
            getSlIndex: getSlIndex,
            getFriendlyKind: getFriendlyKind,
            extendAndSum: extendAndSum,
            queryToObject: queryToObject,
            periodToRange: periodToRange,
            filterByKey: filterByKey,
            filterUnique: filterUnique
        };

        function getTotals(prev, next){
            var totals = {};
            for(var key in prev){
                if(!isNaN(parseFloat(prev[key])) && !isNaN(parseFloat(next[key]))) {
                    totals[key] = parseFloat(prev[key]) + parseFloat(next[key]);
                }
            }
            return totals;
        }

        function setPercentageValues(data, totals){
            return data.map(function(item) {
                for(var key in item){
                    if(totals.hasOwnProperty(key)) {
                        item[key+'_p'] = (item[key] / totals[key] * 100);
                    }
                }
                return item;
            });
        }

        function getAbandonmentRate(nco, nca){
            return nca * 100 / nco;
        }

        function getSlIndex(array){
            var index = -1;
            array.forEach(function(item, i) {
                if(/^sl/.test(item)) {
                    index = i;
                }
            });
            return index;
        }

        function getFriendlyKind(kind){
            var fkind = '';
            switch (kind) {
                case 1:
                    fkind = 'Incoming_Agent';
                    break;
                case 7:
                    fkind = 'Messaging_Chat';
                    break;
                case 129:
                    fkind = 'Autodial_Agent';
                    break;
                default: fkind = null;
            }

            return fkind;
        }

        function extendAndSum(obj1, obj2, index, array){
            var key, val1, val2;
            for( key in obj2 ) {
                if( obj2.hasOwnProperty( key ) ) {
                    val1 = angular.isUndefined(obj1[key]) ? 0 : obj1[key];
                    val2 = angular.isUndefined(obj2[key]) ? 0 : parseFloat(obj2[key]);
                    if(!isNaN(val2)) {
                        // count sum and find average
                        obj1[key] = angular.isNumber(val1) ? (val1 + val2) : (parseFloat(val1) + val2).toFixed(2);
                        // if(index === array.length-1) obj1[key] = obj1[key] / array.length;
                    } else {
                        if(angular.isArray(obj1[key])){
                            // push to the array of strings
                            obj1[key].push(obj2[key]);
                        } else {
                            // create a new array and add values to it
                            obj1[key] = [].concat(obj1[key], obj2[key]);
                        }
                    }
                }
            }
            return obj1;
        }

        function queryToObject(data, keys){
            var obj, key;
            return data.map(function(item) {
                obj = {};
                item.forEach(function(value, index) {
                    key = keys[index];
                    obj[key] = value;
                });
                return obj;
            });
        }

        function periodToRange(period){
            var arr = period.split(' ');
            return {
                begin: moment().startOf(arr[1]).toDate(),
                end: moment().endOf(arr[1]).toDate()
            };
            // return moment().subtract(arr[0], arr[1]).toDate();
        }

        function filterByKey(object, key){
            return object[key];
        }

        function filterUnique(item, index, array){
            if(array.indexOf(item) === -1) return item;
        }

    }

})();