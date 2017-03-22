angular.module('app.routes', [
	'ngRoute'
])
.config(['$routeProvider', function($routeProvider){

	$routeProvider.
		otherwise({
			redirectTo: '/dashboard'
		});
}]);