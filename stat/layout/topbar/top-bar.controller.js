(function(){

	'use strict';

	angular
		.module('app.layout')
		.controller('TopbarController', TopbarController);

	TopbarController.$inject = ['$rootScope', '$scope', '$mdSidenav'];

	function TopbarController($rootScope, $scope, $mdSidenav) {

		var vm = this;

		vm.toggleSidemenu = function() {
			$mdSidenav('sidenav').toggle();
		};

	}

})();