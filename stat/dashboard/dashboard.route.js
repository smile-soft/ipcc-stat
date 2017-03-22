angular.module('app.dashboard')
.config(['$routeProvider', function($routeProvider){

	$routeProvider.
		when('/dashboard', {
			templateUrl: 'dashboard/dashboard.html',
			controller: 'DashController',
			controllerAs: 'dashVm'
		});
}]);