(function(){

	'use strict';

	angular
		.module('app.layout')
		.directive('topBar', topBar);

	function topBar(){

		return {
			restrict: 'AE',
			transclude: true,
			controller: 'TopbarController',
			controllerAs: 'topbarVm',
			templateUrl: 'layout/topbar/topbar.html',
		};

	}

})();