angular.module('app.crr')
.config(['$routeProvider', function($routeProvider){

	$routeProvider.
		when('/crr', {
			templateUrl: 'crr/crr.html',
			controller: 'CrrController',
			controllerAs: 'crrVm'
		});
}]);