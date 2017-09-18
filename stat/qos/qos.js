angular.module('app.qos')
.config(['$routeProvider', function($routeProvider){

	$routeProvider.
		when('/qos', {
			templateUrl: 'qos/qos.html',
			controller: 'QosController',
			controllerAs: 'qosVm'
		});
}]);