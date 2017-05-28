(function(){

    'use strict';

    angular
        .module('app')
        .factory('chartService', chartService);

    chartService.$inject = ['utilsService', 'colourGenerator', 'store'];

    function chartService(utilsService, colourGenerator, store){

        var usedColours = store.get('colours') || [];

        return {
            setChartData: setChartData,
            getChartColour: getChartColour
        };

        function setChartData(array, datakey, labelkey, orderBy){
            var data = [], labels = [], colours = [];

            if(orderBy) 
                array = utilsService.sortObjBy(array, orderBy, 'descend');

            array
            .map(function(item){
                data.push(angular.isNumber(item[datakey]) ? parseFloat(item[datakey].toFixed(2)) : item[datakey] );
                labels.push(item[labelkey]);
                colours.push(getChartColour(item[labelkey]));
            });
            
            
            return {
                data: data,
                labels: labels,
                colours: colours
            };
        }

        function getChartColour(cat){
            var found = false, colour = '';

            usedColours.forEach(function(item){
                if(item.name === cat) found = item;
            });

            if(found) {
                colour = found.colour;
            } else {
                colour = colourGenerator.getColor();
                usedColours.push({ name: cat, colour: colour });
                store.set('colours', usedColours)
            }
            return colour;
        }

    }

})();