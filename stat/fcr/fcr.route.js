angular.module('app.fcr')
.config(['$routeProvider', function($routeProvider){

	$routeProvider.
		when('/fcr', {
			templateUrl: 'fcr/fcr.html',
			controller: 'FcrController',
			controllerAs: 'fcrVm'
		});
}]);