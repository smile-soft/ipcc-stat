(function(){

	'use strict';

	angular
		.module('app.layout')
		.controller('SidemenuController', SidemenuController);

	SidemenuController.$inject = ['$rootScope', '$mdSidenav'];

	function SidemenuController($rootScope, $mdSidenav) {

		var vm = this;
		vm.isOpen = false;

		$rootScope.$on('$routeChangeSuccess', function() {
			if(vm.isOpen) 
				$mdSidenav('sidenav').toggle();
		});

	}

})();