angular.module('app.companies')
.config(['$routeProvider', function($routeProvider){

	$routeProvider.
		when('/companies', {
			templateUrl: 'companies/companies.html',
			controller: 'CompaniesController',
			controllerAs: 'compVm'
		});
}]);